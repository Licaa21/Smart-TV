// Where the kept details screens (detailsCache.js) live between runs of the app, so a title opened yesterday opens whole
// today. IndexedDB, not localStorage: a screen is a hundred kilobytes or more, and localStorage is a few megabytes the
// settings and the server list share. Nothing here may throw: with no IndexedDB, or a store that fails, the screens are
// only kept while the app runs.

const DB_NAME = 'moonfin_details';
const STORE = 'screens';

let opened = null;

const open = () => {
	if (opened) return opened;
	opened = new Promise((resolve) => {
		try {
			const factory = typeof window !== 'undefined' ? window.indexedDB : null;
			if (!factory) {
				resolve(null);
				return;
			}
			const request = factory.open(DB_NAME, 1);
			request.onupgradeneeded = () => {
				request.result.createObjectStore(STORE, {keyPath: 'key'});
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => resolve(null);
			request.onblocked = () => resolve(null);
		} catch (err) {
			resolve(null);
		}
	});
	return opened;
};

const run = async (mode, work) => {
	const db = await open();
	if (!db) return null;
	return new Promise((resolve) => {
		try {
			const transaction = db.transaction(STORE, mode);
			const store = transaction.objectStore(STORE);
			const result = work(store);
			transaction.oncomplete = () => resolve(result && 'result' in result ? result.result : true);
			transaction.onerror = () => resolve(null);
			transaction.onabort = () => resolve(null);
		} catch (err) {
			resolve(null);
		}
	});
};

export const loadScreens = async () => (await run('readonly', (store) => store.getAll())) || [];

export const putScreen = (entry) => run('readwrite', (store) => store.put(entry));

export const deleteScreen = (key) => run('readwrite', (store) => store.delete(key));

export const clearScreens = () => run('readwrite', (store) => store.clear());
