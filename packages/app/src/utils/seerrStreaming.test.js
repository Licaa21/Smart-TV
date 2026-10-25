import {streamingProviders, streamingRegion} from './seerrStreaming';

const netflix = {id: 8, name: 'Netflix', logoPath: '/netflix.jpg', displayPriority: 1};
const hulu = {id: 15, name: 'Hulu', logoPath: '/hulu.jpg', displayPriority: 3};
const crave = {id: 230, name: 'Crave', logoPath: '/crave.jpg', displayPriority: 2};

const details = {
	watchProviders: [
		{iso_3166_1: 'US', link: 'https://www.themoviedb.org/movie/1/watch?locale=US', buy: [crave], flatrate: [hulu, netflix]},
		{iso_3166_1: 'CA', link: 'https://www.themoviedb.org/movie/1/watch?locale=CA', flatrate: [crave]},
		{iso_3166_1: 'GB', buy: [netflix]}
	]
};

describe('streamingRegion', () => {
	it('takes the region the viewer picked first', () => {
		expect(streamingRegion({settings: {streamingRegion: 'CA'}}, {streamingRegion: 'GB'})).toBe('CA');
	});

	it('falls back to the server region, then the US', () => {
		expect(streamingRegion({settings: {}}, {streamingRegion: 'GB'})).toBe('GB');
		expect(streamingRegion(null, null)).toBe('US');
	});

	it('treats a blank setting as no setting', () => {
		expect(streamingRegion({settings: {streamingRegion: ''}}, {streamingRegion: 'GB'})).toBe('GB');
		expect(streamingRegion({settings: {streamingRegion: '  '}}, {streamingRegion: ''})).toBe('US');
	});
});

describe('streamingProviders', () => {
	it('lists the subscription services for the region in the order Seerr sent them', () => {
		expect(streamingProviders(details, 'US')).toEqual([hulu, netflix]);
		expect(streamingProviders(details, 'CA')).toEqual([crave]);
	});

	it('gives nothing for a region with no subscription services or no entry at all', () => {
		expect(streamingProviders(details, 'GB')).toEqual([]);
		expect(streamingProviders(details, 'DE')).toEqual([]);
		expect(streamingProviders({}, 'US')).toEqual([]);
		expect(streamingProviders(null, 'US')).toEqual([]);
	});
});
