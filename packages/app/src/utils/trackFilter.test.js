import {filterTracks, needsTrackFilter, OTHER_LANGUAGE, TRACK_FILTER_MIN, trackLanguages} from './trackFilter';

const tracks = [
	{language: 'eng', text: '1 - English SDH SRT'},
	{language: 'ron', text: '2 - Romanian SRT'},
	{language: 'eng', text: '3 - English Forced ASS'},
	{language: 'und', text: '4 - Track 4'},
	{language: undefined, text: '5 - Commentary'},
	{language: 'ENG', text: '6 - English PGS'}
];

describe('needsTrackFilter', () => {
	it('leaves a short list as it is', () => {
		expect(needsTrackFilter(TRACK_FILTER_MIN)).toBe(false);
		expect(needsTrackFilter(TRACK_FILTER_MIN + 1)).toBe(true);
	});
});

describe('trackLanguages', () => {
	it('lists the languages with the most tracks first and the nameless ones last', () => {
		expect(trackLanguages(tracks)).toEqual([
			{code: 'eng', count: 3},
			{code: 'ron', count: 1},
			{code: '', count: 2}
		]);
	});

	it('is empty with no tracks', () => {
		expect(trackLanguages([])).toEqual([]);
	});
});

describe('filterTracks', () => {
	it('keeps everything when nothing is asked', () => {
		expect(filterTracks(tracks)).toEqual([0, 1, 2, 3, 4, 5]);
	});

	it('keeps one language, whatever its case', () => {
		expect(filterTracks(tracks, {language: 'eng'})).toEqual([0, 2, 5]);
		expect(filterTracks(tracks, {language: 'ron'})).toEqual([1]);
	});

	it('keeps the tracks that name no language under Other', () => {
		expect(filterTracks(tracks, {language: OTHER_LANGUAGE})).toEqual([3, 4]);
	});

	it('wants every word of the query, in any order and case', () => {
		expect(filterTracks(tracks, {query: 'forced ENGLISH'})).toEqual([2]);
		expect(filterTracks(tracks, {query: 'srt'})).toEqual([0, 1]);
		expect(filterTracks(tracks, {query: 'nothing here'})).toEqual([]);
	});

	it('combines the language and the query', () => {
		expect(filterTracks(tracks, {language: 'eng', query: 'srt'})).toEqual([0]);
		expect(filterTracks(tracks, {language: 'ron', query: 'ass'})).toEqual([]);
	});

	it('ignores spaces around the query', () => {
		expect(filterTracks(tracks, {query: '   pgs  '})).toEqual([5]);
	});
});
