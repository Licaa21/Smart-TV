import {forgetKeptScreens} from './forgetKeptScreens';

describe('forgetKeptScreens', () => {
	const real = window.indexedDB;
	const setDb = (value) => Object.defineProperty(window, 'indexedDB', {value, configurable: true, writable: true});
	beforeEach(() => window.localStorage.removeItem('moonfin_kept_screens_forgotten'));
	afterEach(() => setDb(real));

	it('deletes the database the earlier releases kept the screens in, once', () => {
		const deleteDatabase = jest.fn(() => ({}));
		setDb({deleteDatabase});
		forgetKeptScreens();
		forgetKeptScreens();
		expect(deleteDatabase).toHaveBeenCalledTimes(1);
		expect(deleteDatabase).toHaveBeenCalledWith('moonfin_details');
	});

	it('does nothing without IndexedDB, and does not throw when it fails, and then tries again at the next start', () => {
		setDb(undefined);
		expect(() => forgetKeptScreens()).not.toThrow();
		const failing = jest.fn(() => { throw new Error('blocked'); });
		setDb({deleteDatabase: failing});
		expect(() => forgetKeptScreens()).not.toThrow();
		forgetKeptScreens();
		expect(failing).toHaveBeenCalledTimes(2);
	});
});
