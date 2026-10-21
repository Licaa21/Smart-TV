import {browseStateKey, forgetReturnPoint, readBrowseState, takeBrowseState, writeBrowseState} from './seerrBrowseState';

describe('seerrBrowseState', () => {
	test('the card opened is forgotten once it has been returned to, the filters stay', () => {
		const key = browseStateKey('genre', {id: 28}, 'tv');
		writeBrowseState(key, {sortBy: 'vote_average.desc', focusedId: 7, pagesLoaded: 4});
		forgetReturnPoint(key);
		expect(readBrowseState(key)).toEqual({sortBy: 'vote_average.desc', focusedId: null, pagesLoaded: null});
	});

	test('forgetting a browse never visited adds nothing', () => {
		forgetReturnPoint('never|1|tv');
		expect(readBrowseState('never|1|tv')).toBeNull();
	});

	test('a browse left by opening a title is taken back once, and a plain leave starts fresh', () => {
		const key = browseStateKey('studio', {id: 5}, 'movie');
		writeBrowseState(key, {sortBy: 'vote_average.desc', focusedId: 9, pagesLoaded: 3});
		expect(takeBrowseState(key).focusedId).toBe(9);
		forgetReturnPoint(key);
		expect(takeBrowseState(key)).toBeNull();
		expect(readBrowseState(key)).toBeNull();
	});
});
