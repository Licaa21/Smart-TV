// 2.1.3 to 2.1.5 kept the details screens in an IndexedDB database on the device. That is gone, so what it left behind is
// deleted once, at the first start that gets here. It does nothing where there is no such database, and never throws.
const DONE_KEY = 'moonfin_kept_screens_forgotten';

export const forgetKeptScreens = () => {
	try {
		if (typeof window === 'undefined' || !window.indexedDB) return;
		if (window.localStorage.getItem(DONE_KEY)) return;
		const request = window.indexedDB.deleteDatabase('moonfin_details');
		if (request) request.onerror = () => {};
		window.localStorage.setItem(DONE_KEY, '1');
	} catch (err) {
		// nothing to forget, or storage that cannot say it was done: tried again at the next start
	}
};
