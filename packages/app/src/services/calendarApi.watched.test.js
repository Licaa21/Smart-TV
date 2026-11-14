import {watchedIds} from './calendarApi';

jest.mock('./seerrApi', () => ({__esModule: true, default: {}}));

describe('watchedIds', () => {
	it('is the ids among those asked for that are watched', async () => {
		const api = {getItems: jest.fn(() => Promise.resolve({Items: [
			{Id: 'a', UserData: {Played: true}},
			{Id: 'b', UserData: {Played: false}},
			{Id: 'c'}
		]}))};
		const out = await watchedIds(api, ['a', 'b', 'c']);
		expect([...out]).toEqual(['a']);
		expect(api.getItems).toHaveBeenCalledWith(expect.objectContaining({Ids: 'a,b,c', EnableUserData: true}));
	});

	it('asks for fifty at a time, and counts a read that fails as nothing watched', async () => {
		const ids = Array.from({length: 120}, (_, i) => `i${i}`);
		const api = {getItems: jest.fn()
			.mockResolvedValueOnce({Items: [{Id: 'i0', UserData: {Played: true}}]})
			.mockRejectedValueOnce(new Error('down'))
			.mockResolvedValueOnce({Items: [{Id: 'i100', UserData: {Played: true}}]})};
		jest.spyOn(console, 'warn').mockImplementation(() => {});
		const out = await watchedIds(api, ids);
		expect(api.getItems).toHaveBeenCalledTimes(3);
		expect([...out]).toEqual(['i0', 'i100']);
		console.warn.mockRestore();
	});

	it('keeps what was known of a chunk whose read fails, so a blip does not bring watched titles back', async () => {
		const api = {getItems: jest.fn().mockRejectedValue(new Error('down'))};
		jest.spyOn(console, 'warn').mockImplementation(() => {});
		const out = await watchedIds(api, ['a', 'b'], new Set(['a', 'zz']));
		expect([...out]).toEqual(['a']);
		console.warn.mockRestore();
	});

	it('is empty with nothing to ask', async () => {
		const api = {getItems: jest.fn()};
		expect((await watchedIds(api, [])).size).toBe(0);
		expect(api.getItems).not.toHaveBeenCalled();
	});
});
