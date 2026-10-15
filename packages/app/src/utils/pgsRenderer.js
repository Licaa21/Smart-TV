/**
 * PGS (Blu-ray bitmap subtitle) rendering utility.
 * initPgsRenderer (webOS) - attaches to <video>, auto-syncs via timeupdate.
 * initPgsInBandRenderer (webOS) - same, but the .sup bytes are pulled out of the
 *   container the player is streaming instead of being fetched as an extracted file.
 * initPgsCanvasRenderer (Tizen) - canvas only, call renderAtTimestamp() manually.
 */

import {createInBandPgsSource} from './mkvPgsSource';

let streamUrlCounter = 0;

const installStreamFetch = (url, readable) => {
	const original = globalThis.fetch;
	globalThis.fetch = (input, init) => {
		const requested = typeof input === 'string' ? input : input?.url;
		if (requested === url) {
			return Promise.resolve(new Response(readable, {headers: {'Content-Type': 'application/octet-stream'}}));
		}
		return original(input, init);
	};
	return () => {
		globalThis.fetch = original;
	};
};

class InBandPgsRenderer {
	constructor(renderer, source, clock) {
		this.renderer = renderer;
		this.source = source;
		this.clock = clock;
	}

	get timeOffset() {
		return this.renderer.timeOffset;
	}

	// libpgs draws at the video time plus this offset, and the reader follows that same time.
	set timeOffset(value) {
		this.renderer.timeOffset = value;
		this.clock.offset = value;
	}

	/** True when a seek went back before the data libpgs holds, which only a new renderer fixes. */
	needsRestart(time) {
		return this.source.needsRestart(time + this.clock.offset);
	}

	dispose() {
		this.source.dispose();
		this.renderer.dispose();
	}
}

export const initPgsRenderer = async (videoElement, subtitleStream) => {
	if (!subtitleStream?.deliveryUrl) return null;

	try {
		const {PgsRenderer} = await import('libpgs');
		return new PgsRenderer({
			workerUrl: 'libpgs.worker.js',
			video: videoElement,
			subUrl: subtitleStream.deliveryUrl
		});
	} catch (err) {
		console.error('[PgsRenderer] Failed to initialize', err);
		return null;
	}
};

/**
 * Render PGS straight out of the container. libpgs loads a subtitle by url and streams
 * whatever the response delivers, so the bytes are handed to it through a fetch that
 * answers for a url nobody else can ask for, and the .sup framing is produced near the
 * playhead by the in band source.
 */
export const initPgsInBandRenderer = async (videoElement, subtitleStream, options = {}) => {
	if (!subtitleStream?.inBand || !videoElement) return null;

	const clock = {offset: options.timeOffset || 0};
	let source = null;
	try {
		source = createInBandPgsSource({
			streamUrl: subtitleStream.inBand.streamUrl,
			subtitleOrdinal: subtitleStream.inBand.ordinal,
			getTime: () => videoElement.currentTime + clock.offset,
			startTime: (options.startTime ?? videoElement.currentTime) + clock.offset
		});
		if (!source || !(await source.ready)) {
			source?.dispose();
			console.warn('[PgsRenderer] In-band PGS source unavailable');
			return null;
		}

		const {PgsRenderer} = await import('libpgs');
		const url = `moonfin-inband-pgs://${++streamUrlCounter}`;
		// libpgs 0.8 calls fetch synchronously from its constructor when given subUrl, so the
		// swap only has to last that long. Its worker would fetch with its own global, hence
		// the main thread mode.
		const restore = installStreamFetch(url, source.readable);
		let renderer;
		try {
			renderer = new PgsRenderer({
				workerUrl: 'libpgs.worker.js',
				video: videoElement,
				subUrl: url,
				mode: 'mainThread',
				timeOffset: clock.offset
			});
		} finally {
			restore();
		}
		return new InBandPgsRenderer(renderer, source, clock);
	} catch (err) {
		source?.dispose();
		console.error('[PgsRenderer] Failed to initialize in band PGS', err);
		return null;
	}
};

export const initPgsCanvasRenderer = async (canvasElement, subtitleStream) => {
	if (!subtitleStream?.deliveryUrl || !canvasElement) return null;

	try {
		const {PgsRenderer} = await import('libpgs');
		return new PgsRenderer({
			canvas: canvasElement,
			subUrl: subtitleStream.deliveryUrl,
			mode: 'mainThread'
		});
	} catch (err) {
		console.error('[PgsRenderer] Failed to initialize canvas renderer', err);
		return null;
	}
};

// libpgs keeps the rectangle it last drew on, to clear it again, on the object that draws. Where that object sits inside the
// renderer is the library's business, so it is looked for a few levels down rather than named.
const drawnAreaOwners = new WeakMap();
const findDrawnAreaOwner = (root) => {
	const queue = [[root, 0]];
	const seen = new Set();
	while (queue.length) {
		const [node, depth] = queue.shift();
		if (!node || typeof node !== 'object' || seen.has(node)) continue;
		seen.add(node);
		const area = node.dirtyArea;
		if (area && typeof area.x === 'number' && typeof area.width === 'number') return node;
		if (depth < 3) Object.keys(node).forEach((key) => queue.push([node[key], depth + 1]));
	}
	return null;
};

// Where the last picture subtitle was drawn, as fractions of the canvas, or null when nothing is on it.
export const pgsDrawnArea = (renderer, canvas) => {
	if (!renderer || !canvas || !canvas.width || !canvas.height) return null;
	let owner = drawnAreaOwners.get(renderer);
	if (owner === undefined) {
		owner = findDrawnAreaOwner(renderer);
		drawnAreaOwners.set(renderer, owner);
	}
	const area = owner && owner.dirtyArea;
	if (!area || area.empty || !(area.width > 0) || !(area.height > 0)) return null;
	return {
		left: area.x / canvas.width,
		top: area.y / canvas.height,
		width: area.width / canvas.width,
		height: area.height / canvas.height
	};
};

export const disposePgsRenderer = (renderer) => {
	if (renderer?.dispose) {
		try {
			renderer.dispose();
		} catch (err) {
			console.warn('[PgsRenderer] Error disposing renderer', err);
		}
	}
};

export const clearPgsCanvas = (canvas) => {
	if (canvas) {
		const ctx = canvas.getContext('2d');
		if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
	}
};
