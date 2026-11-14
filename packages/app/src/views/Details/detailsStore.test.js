
// A small stand-in for IndexedDB: one store of records by key, answered the way a request answers, a beat later.
const fakeIndexedDb = () => {
	const records = new Map();
	const request = (value) => {
		const req = {result: value};
		return req;
	};
	const db = {
		createObjectStore: () => {},
		transaction: () => {
			const tx = {};
			const settle = () => setTimeout(() => tx.oncomplete && tx.oncomplete(), 0);
			tx.objectStore = () => ({
				getAll: () => { const r = request(Array.from(records.values())); settle(); return r; },
				put: (entry) => { records.set(entry.key, entry); const r = request(entry.key); settle(); return r; },
				delete: (key) => { records.delete(key); const r = request(undefined); settle(); return r; },
				clear: () => { records.clear(); const r = request(undefined); settle(); return r; }
			});
			return tx;
		}
	};
	return {
		records,
		open: () => {
			const req = {result: db};
			setTimeout(() => { if (req.onupgradeneeded) req.onupgradeneeded(); if (req.onsuccess) req.onsuccess(); }, 0);
			return req;
		}
	};
};

describe('the details store', () => {
	it('keeps screens and gives them back', async () => {
		const idb = fakeIndexedDb();
		Object.defineProperty(window, 'indexedDB', {value: idb, configurable: true});
		jest.resetModules();
		const store = require('./detailsStore');
		await store.putScreen({key: 'a', at: 1, snapshot: {item: {Id: 'a'}}});
		await store.putScreen({key: 'b', at: 2, snapshot: {item: {Id: 'b'}}});
		expect((await store.loadScreens()).map((entry) => entry.key).sort()).toEqual(['a', 'b']);
		await store.deleteScreen('a');
		expect((await store.loadScreens()).map((entry) => entry.key)).toEqual(['b']);
		await store.clearScreens();
		expect(await store.loadScreens()).toEqual([]);
	});

	it('does nothing, and does not throw, with no IndexedDB', async () => {
		Object.defineProperty(window, 'indexedDB', {value: undefined, configurable: true});
		jest.resetModules();
		const store = require('./detailsStore');
		expect(await store.loadScreens()).toEqual([]);
		await expect(store.putScreen({key: 'a'})).resolves.toBeNull();
		await expect(store.deleteScreen('a')).resolves.toBeNull();
		await expect(store.clearScreens()).resolves.toBeNull();
	});
});
