import {refreshHomeWhenDone} from './useLibraryRefresh';

jest.mock('../context/AuthContext', () => ({useAuth: () => ({api: {}, user: {}})}));

describe('refreshHomeWhenDone', () => {
	let refreshes;
	const listener = (e) => refreshes.push(e.detail);

	beforeEach(() => {
		jest.useFakeTimers();
		refreshes = [];
		window.addEventListener('moonfin:browseRefresh', listener);
	});
	afterEach(() => {
		window.removeEventListener('moonfin:browseRefresh', listener);
		jest.useRealTimers();
	});

	// Lets the timers and the answers that wait on them play out
	const settle = async (ms) => {
		for (let spent = 0; spent < ms; spent += 1000) {
			jest.advanceTimersByTime(1000);
			await Promise.resolve();
			await Promise.resolve();
		}
	};

	it('refreshes Home once the scan has stopped running, and not before', async () => {
		const answers = [true, true, false];
		const api = {isLibraryScanRunning: jest.fn(() => Promise.resolve(answers.shift()))};
		refreshHomeWhenDone(api);
		await settle(8000);
		expect(refreshes).toEqual([]);
		await settle(12000);
		expect(api.isLibraryScanRunning).toHaveBeenCalledTimes(3);
		expect(refreshes).toEqual([{reload: true, featured: true}]);
	});

	it('refreshes after a while anyway when the server does not say how the scan is going', async () => {
		refreshHomeWhenDone({isLibraryScanRunning: () => Promise.resolve(null)});
		await settle(6000);
		expect(refreshes).toEqual([]);
		await settle(10000);
		expect(refreshes).toHaveLength(1);
	});

	it('lets a newer scan take over from an older watch, so Home refreshes once', async () => {
		const api = {isLibraryScanRunning: () => Promise.resolve(false)};
		refreshHomeWhenDone(api);
		refreshHomeWhenDone(api);
		await settle(8000);
		expect(refreshes).toHaveLength(1);
	});
});
