import {fetchPrerolls, isPreroll, nextInQueue, shouldAutoAdvance} from './cinemaMode';

const movie = {Id: 'movie-1', Type: 'Movie'};
const enabled = {cinemaModeEnabled: true};
const apiWith = (Items) => ({getIntros: jest.fn().mockResolvedValue({Items})});

describe('fetchPrerolls', () => {
	it('marks each intro and keeps their order', async () => {
		const api = apiWith([{Id: 'a'}, {Id: 'b'}]);
		const prerolls = await fetchPrerolls(api, movie, enabled);
		expect(prerolls.map((p) => p.Id)).toEqual(['a', 'b']);
		expect(prerolls.every(isPreroll)).toBe(true);
		expect(api.getIntros).toHaveBeenCalledWith('movie-1');
	});

	it('returns nothing when the setting is off', async () => {
		const api = apiWith([{Id: 'a'}]);
		expect(await fetchPrerolls(api, movie, {})).toEqual([]);
		expect(await fetchPrerolls(api, movie, {cinemaModeEnabled: false})).toEqual([]);
		expect(api.getIntros).not.toHaveBeenCalled();
	});

	it('only fetches for movies', async () => {
		const api = apiWith([{Id: 'a'}]);
		expect(await fetchPrerolls(api, {Id: 'e1', Type: 'Episode'}, enabled)).toEqual([]);
		expect(await fetchPrerolls(api, {Id: 't1', Type: 'Audio'}, enabled)).toEqual([]);
		expect(api.getIntros).not.toHaveBeenCalled();
	});

	it('drops intros without an id', async () => {
		const prerolls = await fetchPrerolls(apiWith([{Id: 'a'}, {}, {Name: 'x'}]), movie, enabled);
		expect(prerolls.map((p) => p.Id)).toEqual(['a']);
	});

	it('treats an empty or missing list as no intros', async () => {
		expect(await fetchPrerolls(apiWith([]), movie, enabled)).toEqual([]);
		expect(await fetchPrerolls({getIntros: jest.fn().mockResolvedValue(null)}, movie, enabled)).toEqual([]);
	});

	it('treats a failed fetch as no intros', async () => {
		const api = {getIntros: jest.fn().mockRejectedValue(new Error('down'))};
		expect(await fetchPrerolls(api, movie, enabled)).toEqual([]);
	});
});

describe('nextInQueue', () => {
	const queue = [{Id: 'intro'}, {Id: 'feature'}];

	it('returns the following entry', () => {
		expect(nextInQueue(queue, {Id: 'intro'})).toBe(queue[1]);
	});

	it('returns null at the end of the queue', () => {
		expect(nextInQueue(queue, {Id: 'feature'})).toBe(null);
	});

	it('returns null off the queue or without one', () => {
		expect(nextInQueue(queue, {Id: 'other'})).toBe(null);
		expect(nextInQueue([], {Id: 'intro'})).toBe(null);
		expect(nextInQueue(null, {Id: 'intro'})).toBe(null);
		expect(nextInQueue(queue, null)).toBe(null);
	});

	it('matches ids across types, since server ids arrive both ways', () => {
		expect(nextInQueue([{Id: 1}, {Id: 2}], {Id: '1'})).toEqual({Id: 2});
	});

	it('steps back to the entry before with a step of -1', () => {
		expect(nextInQueue(queue, {Id: 'feature'}, -1)).toBe(queue[0]);
		expect(nextInQueue(queue, {Id: 'intro'}, -1)).toBe(null);
	});
});

describe('isPreroll', () => {
	it('only recognizes the explicit mark', () => {
		expect(isPreroll({_preroll: true})).toBe(true);
		expect(isPreroll({_preroll: 1})).toBe(false);
		expect(isPreroll({})).toBe(false);
		expect(isPreroll(null)).toBe(false);
	});
});

describe('shouldAutoAdvance', () => {
	const episode = {Id: 'e1', Type: 'Episode'};

	it('advances only while the setting is on', () => {
		expect(shouldAutoAdvance(true, episode)).toBe(true);
		expect(shouldAutoAdvance(false, episode)).toBe(false);
	});

	it('runs a pre-roll into the feature whatever the setting says', () => {
		expect(shouldAutoAdvance(false, {_preroll: true})).toBe(true);
	});

	it('treats an absent setting as on', () => {
		expect(shouldAutoAdvance(undefined, episode)).toBe(true);
	});
});
