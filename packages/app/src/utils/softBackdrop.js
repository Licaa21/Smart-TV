// A backdrop the server cannot blur (TMDB's, for a title from Seerr or an outside list) made soft the way the server
// does it for the library's own: the picture is made small and the screen scales it back up, which costs nothing to
// draw. A CSS blur filter was the only way before, and it is held back on a set at the Low or Medium performance
// level, so those titles showed a sharp backdrop next to the library's blurred ones.

const CACHE_MAX = 24;
// A picture a layer may still be showing is not given up at once
const RELEASE_DELAY_MS = 60000;
// A picture that did not answer in this long is let go, and the pictures that could not be made soft are not tried again for a while
const FETCH_TIMEOUT_MS = 5000;
const FAILED_MS = 5 * 60 * 1000;
const failed = new Map();
const cache = new Map();
const pending = new Map();

export const canSoften = () => typeof window !== 'undefined' && typeof document !== 'undefined' &&
	typeof window.fetch === 'function' && typeof window.createImageBitmap === 'function' &&
	typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';

// How wide the small picture is: the blur amount is a radius on the screen, so the picture shrinks until one of its
// pixels is about that wide, and a little more.
export const softWidth = (blur) => Math.max(24, Math.round(((typeof window !== 'undefined' && window.innerWidth) || 1920) / (blur * 2)));

const remember = (key, blobUrl) => {
	cache.set(key, blobUrl);
	while (cache.size > CACHE_MAX) {
		const [oldest, old] = cache.entries().next().value;
		cache.delete(oldest);
		setTimeout(() => URL.revokeObjectURL(old), RELEASE_DELAY_MS);
	}
};

const draw = (small) => new Promise((resolve, reject) => {
	// Drawn twice as large with the engine's own smoothing, so the screen has gentler steps to scale up than the pixels of
	// the small picture
	const canvas = document.createElement('canvas');
	canvas.width = small.width * 2;
	canvas.height = small.height * 2;
	const context = canvas.getContext('2d');
	if (!context) {
		small.close?.();
		reject(new Error('no canvas'));
		return;
	}
	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = 'high';
	context.drawImage(small, 0, 0, canvas.width, canvas.height);
	small.close?.();
	canvas.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('no blob'))), 'image/jpeg', 0.85);
});

// The address of the soft copy of the picture at url for that blur amount, or null when there can be none (and the
// caller blurs it some other way). Copies are kept, and a picture asked for twice is made once.
export const softBackdropUrl = (url, blur) => {
	if (!url || !(blur > 0) || !canSoften()) return Promise.resolve(null);
	const width = softWidth(blur);
	const key = `${width}|${url}`;
	if ((failed.get(url) || 0) > Date.now()) return Promise.resolve(null);
	if (cache.has(key)) {
		const kept = cache.get(key);
		cache.delete(key);
		cache.set(key, kept);
		return Promise.resolve(kept);
	}
	if (pending.has(key)) return pending.get(key);
	const controller = typeof window.AbortController === 'function' ? new window.AbortController() : null;
	const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;
	const work = window.fetch(url, {credentials: 'omit', signal: controller ? controller.signal : undefined})
		.then((response) => {
			if (!response.ok) throw new Error('status');
			return response.blob();
		})
		.then((blob) => window.createImageBitmap(blob))
		.then((natural) => {
			const height = Math.max(1, Math.round(width * natural.height / natural.width));
			return window.createImageBitmap(natural, 0, 0, natural.width, natural.height, {resizeWidth: width, resizeHeight: height, resizeQuality: 'high'})
				.then((small) => {
					natural.close?.();
					return small;
				}, (error) => {
					natural.close?.();
					throw error;
				});
		})
		.then(draw)
		.then((blobUrl) => {
			remember(key, blobUrl);
			return blobUrl;
		}, () => {
			failed.set(url, Date.now() + FAILED_MS);
			return null;
		})
		.then((result) => {
			clearTimeout(timer);
			pending.delete(key);
			return result;
		});
	pending.set(key, work);
	return work;
};
