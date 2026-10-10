// What an HLS playlist says, for the diagnostic report when the TV refuses a stream. A refusal comes back as
// a bare error code, and the playlist is the only place to see which tags or codecs it was offered.

const MAX_CHARS = 1600;
const TIMEOUT_MS = 5000;

// The access token rides on the playlist's own addresses, and the report is shared
export const redactToken = (text) => String(text).replace(/(api_?key|X-Emby-Token|X-MediaBrowser-Token|token)=[^&"\s]+/gi, '$1=…');

// The first address in a master playlist that points at a media playlist, if it is one
export const firstVariantUri = (master) => {
	const lines = String(master).split(/\r?\n/);
	const at = lines.findIndex((line) => line.startsWith('#EXT-X-STREAM-INF'));
	if (at < 0) return null;
	return lines.slice(at + 1).find((line) => line && !line.startsWith('#')) || null;
};

const resolveAgainst = (uri, base) => {
	if (/^https?:\/\//i.test(uri)) return uri;
	const origin = base.match(/^https?:\/\/[^/]+/i)?.[0] || '';
	if (uri.startsWith('/')) return origin + uri;
	return base.slice(0, base.lastIndexOf('/') + 1) + uri;
};

const fetchText = async (url) => {
	const controller = typeof AbortController === 'function' ? new AbortController() : null;
	const timer = setTimeout(() => controller?.abort(), TIMEOUT_MS);
	try {
		const response = await fetch(url, controller ? {signal: controller.signal} : undefined);
		return response.ok ? await response.text() : `HTTP ${response.status}`;
	} finally {
		clearTimeout(timer);
	}
};

export const describeHlsManifest = async (url) => {
	const master = await fetchText(url);
	const info = {master: redactToken(master.slice(0, MAX_CHARS))};
	const variant = firstVariantUri(master);
	if (variant) {
		try {
			info.media = redactToken((await fetchText(resolveAgainst(variant, url))).slice(0, MAX_CHARS));
		} catch (error) {
			info.media = `not read: ${error?.message || error}`;
		}
	}
	return info;
};
