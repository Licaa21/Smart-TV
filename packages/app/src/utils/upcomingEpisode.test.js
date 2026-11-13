import {formatUpcomingEpisode, clearUpcomingEpisodeCache} from './upcomingEpisode';

describe('formatUpcomingEpisode', () => {
	beforeEach(() => {
		clearUpcomingEpisodeCache();
	});

	const referenceNow = new Date(2026, 8, 12, 12, 0, 0); // Saturday, Sep 12, 2026

	it('returns null when airDate is missing or invalid', () => {
		expect(formatUpcomingEpisode(null)).toBeNull();
		expect(formatUpcomingEpisode({})).toBeNull();
		expect(formatUpcomingEpisode({airDate: 'invalid-date'})).toBeNull();
	});

	it('formats today air dates with season and episode numbers', () => {
		const today = new Date(2026, 8, 12, 20, 0, 0);
		const result = formatUpcomingEpisode({
			airDate: today.toISOString(),
			seasonNumber: 2,
			episodeNumber: 1
		}, referenceNow);

		expect(result).toBe('Next: Today (S2:E1)');
	});

	it('formats tomorrow air dates', () => {
		const tomorrow = new Date(2026, 8, 13, 20, 0, 0);
		const result = formatUpcomingEpisode({
			airDate: tomorrow.toISOString(),
			seasonNumber: 2,
			episodeNumber: 2
		}, referenceNow);

		expect(result).toBe('Next: Tomorrow (S2:E2)');
	});

	it('formats within 7 days with weekday name', () => {
		const tuesday = new Date(2026, 8, 15, 20, 0, 0); // Tuesday
		const result = formatUpcomingEpisode({
			airDate: tuesday.toISOString(),
			seasonNumber: 1,
			episodeNumber: 5
		}, referenceNow);

		expect(result).toBe('Next: Tuesday (S1:E5)');
	});

	it('formats beyond 7 days with localized month and day', () => {
		const october = new Date(2026, 9, 15, 20, 0, 0); // Oct 15
		const result = formatUpcomingEpisode({
			airDate: october.toISOString(),
			seasonNumber: 3,
			episodeNumber: 1
		}, referenceNow);

		expect(result).toBe('Next: Oct 15 (S3:E1)');
	});

	it('formats cleanly even when season or episode numbers are null', () => {
		const tomorrow = new Date(2026, 8, 13, 20, 0, 0);
		const result = formatUpcomingEpisode({
			airDate: tomorrow.toISOString()
		}, referenceNow);

		expect(result).toBe('Next: Tomorrow');
	});
});

describe('fetchUpcomingEpisode reading Sonarr\'s calendar', () => {
	const mockCalendar = jest.fn();
	const series = (id, tvdb) => ({Id: id, Type: 'Series', ProviderIds: {Tvdb: tvdb}});
	let fetchUpcomingEpisode;
	let clearCache;

	beforeEach(() => {
		jest.resetModules();
		mockCalendar.mockReset();
		jest.doMock('../services/seerrApi', () => ({
			__esModule: true,
			getArrCalendar: (...args) => mockCalendar(...args),
			getSonarrSettings: () => Promise.reject(new Error('none'))
		}));
		({fetchUpcomingEpisode, clearUpcomingEpisodeCache: clearCache} = require('./upcomingEpisode'));
		clearCache();
	});

	afterEach(() => {
		jest.dontMock('../services/seerrApi');
	});

	it('sends one request for titles asking while it is out', async () => {
		mockCalendar.mockResolvedValue({items: []});
		await Promise.all([
			fetchUpcomingEpisode({item: series('a', '1'), settings: {}}),
			fetchUpcomingEpisode({item: series('b', '2'), settings: {}}),
			fetchUpcomingEpisode({item: series('c', '3'), settings: {}})
		]);
		expect(mockCalendar).toHaveBeenCalledTimes(1);
	});

	it('does not ask again at once when the read came back with nothing', async () => {
		mockCalendar.mockResolvedValue({items: null});
		await fetchUpcomingEpisode({item: series('a', '1'), settings: {}});
		await fetchUpcomingEpisode({item: series('b', '2'), settings: {}});
		expect(mockCalendar).toHaveBeenCalledTimes(1);
	});

	it('keeps a good read for the next titles', async () => {
		mockCalendar.mockResolvedValue({items: []});
		await fetchUpcomingEpisode({item: series('a', '1'), settings: {}});
		await fetchUpcomingEpisode({item: series('b', '2'), settings: {}});
		expect(mockCalendar).toHaveBeenCalledTimes(1);
	});
});
