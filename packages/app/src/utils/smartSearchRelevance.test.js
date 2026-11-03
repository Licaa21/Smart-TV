import {relevantSmartResults} from './smartSearchRelevance';

// What the plugin sends with its tuning flag on: a library item is {Card, Score, Similarity}, a Seerr entry carries `similarity`.
const lib = (sims) => sims.map((Similarity, i) => ({Card: {Id: `m${i}`, Name: `Film ${i}`, Type: 'Movie'}, Score: Similarity + 0.2, Similarity}));
const seerr = (sims) => sims.map((similarity, i) => ({id: i, mediaType: 'movie', title: `Seerr ${i}`, score: similarity + 0.2, similarity}));
const ids = (items) => items.map((item) => item.Id);

// The first numbers are the ones the plugin chat read off the real library on 2026-11-03.
describe('relevantSmartResults', () => {
	test('keeps the real matches of a library row and drops the filler behind them', () => {
		const answer = {Items: lib([0.584, 0.506, 0.322, 0.314, 0.303, 0.358, 0.331, 0.291, 0.372, 0.263])};
		expect(ids(relevantSmartResults(answer).items)).toEqual(['m0', 'm1']);
	});

	test('a close pair at the top stays two when the rest only comes near the top', () => {
		const answer = {Items: lib([0.792, 0.783, 0.549, 0.533, 0.507, 0.473, 0.481, 0.498, 0.463, 0.441])};
		expect(ids(relevantSmartResults(answer).items)).toEqual(['m0', 'm1']);
	});

	test('a row whose best match is not good keeps only what clears the floor', () => {
		const answer = {Items: lib([0.479, 0.417])};
		expect(ids(relevantSmartResults(answer).items)).toEqual(['m0']);
		expect(relevantSmartResults({Items: lib([0.42, 0.4, 0.39])}).items).toEqual([]);
	});

	test('keeps what is close to the best one of its own row, and the order the plugin gave', () => {
		const answer = {Items: lib([0.579, 0.533, 0.441, 0.418, 0.43, 0.468, 0.384])};
		expect(ids(relevantSmartResults(answer).items)).toEqual(['m0', 'm1', 'm5']);
	});

	test('the Seerr row is cut on its own best, not on the library row\'s', () => {
		const answer = {Items: lib([0.8, 0.79]), Seerr: seerr([0.649, 0.374, 0.369, 0.44, 0.32])};
		expect(relevantSmartResults(answer).seerr.map((r) => r.id)).toEqual([0]);
		expect(relevantSmartResults(answer).items).toHaveLength(2);
	});

	test('unwraps the card of a library item', () => {
		const out = relevantSmartResults({Items: lib([0.6])});
		expect(out.items[0]).toEqual({Id: 'm0', Name: 'Film 0', Type: 'Movie'});
	});

	test('with no score on a result, everything is kept as the plugin sent it', () => {
		const plain = [{Id: 'a', Name: 'A', Type: 'Movie'}, {Id: 'b', Name: 'B', Type: 'Movie'}];
		expect(relevantSmartResults({Items: plain, Seerr: [{id: 1, title: 'X'}]})).toEqual({items: plain, seerr: [{id: 1, title: 'X'}]});
		// one result without a score is enough to trust none of them
		const mixed = [...lib([0.9]), {Id: 'z', Name: 'Z', Type: 'Movie'}];
		expect(relevantSmartResults({Items: mixed}).items).toHaveLength(2);
	});

	test('nothing in the answer gives nothing', () => {
		expect(relevantSmartResults({})).toEqual({items: [], seerr: []});
		expect(relevantSmartResults(null)).toEqual({items: [], seerr: []});
	});

	// Written down so it is not mistaken for a bug: with no real match in the library the best of the filler can still be a
	// 0.5, which no cutoff separates from a real match of 0.5 in another query.
	test('cannot tell a library with no match at all from one with a middling match', () => {
		const answer = {Items: lib([0.522, 0.505, 0.476, 0.482, 0.525, 0.481, 0.43, 0.444, 0.442, 0.392])};
		expect(ids(relevantSmartResults(answer).items)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4', 'm5']);
	});
});
