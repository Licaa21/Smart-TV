import {isSupportedSlider, parseSlider, reconcileSliderRows, sliderQuery} from './seerrSliders';
import {makeSeerrSliderRow} from './pickedRows';

jest.mock('../services/seerrApi', () => ({}));
jest.mock('../services/jellyfinApi', () => ({getServerUrl: () => 'http://server:8096'}));

describe('parseSlider', () => {
	it('keeps what a row needs and skips an entry without a numeric id or type', () => {
		expect(parseSlider({id: 3, type: 17, title: ' Space ', data: ' star wars ', enabled: true}))
			.toEqual({id: 3, type: 17, enabled: true, title: 'Space', data: 'star wars'});
		expect(parseSlider({id: '3', type: 17})).toBeNull();
		expect(parseSlider({id: 3, type: 17, enabled: false}).enabled).toBe(false);
	});
});

describe('sliderQuery', () => {
	it('builds the route each custom type uses, escaping what a search can carry', () => {
		expect(sliderQuery({type: 13, data: '9715,210024'})).toBe('discover/movies?keywords=9715%2C210024');
		expect(sliderQuery({type: 17, data: "Ocean's (2001)!"})).toBe('search?query=Ocean%27s%20%282001%29%21');
		expect(sliderQuery({type: 18, data: '41077'})).toBe('discover/movies/studio/41077');
		expect(sliderQuery({type: 21, data: 'US, 8|337'})).toBe('discover/tv?watchRegion=US&watchProviders=8%7C337');
	});

	it("has nothing for Seerr's own rows, a streaming slider missing a part, or empty data", () => {
		expect(sliderQuery({type: 1, data: 'x'})).toBeNull();
		expect(sliderQuery({type: 20, data: 'US'})).toBeNull();
		expect(sliderQuery({type: 14, data: ''})).toBeNull();
	});

	it('only offers a slider that is on, titled and of a known type', () => {
		expect(isSupportedSlider({type: 14, data: '28', title: 'Action', enabled: true})).toBe(true);
		expect(isSupportedSlider({type: 14, data: '28', title: '', enabled: true})).toBe(false);
		expect(isSupportedSlider({type: 14, data: '28', title: 'Action', enabled: false})).toBe(false);
	});
});

describe('reconcileSliderRows', () => {
	const server = 'http://server:8096';
	const row = (sliderId, sliderType, name) => makeSeerrSliderRow({serverUrl: server, sliderId, sliderType, name}, true, 0);

	it("renames rows to Seerr's titles, drops the ones it no longer has and leaves other servers alone", () => {
		const other = makeSeerrSliderRow({serverUrl: 'http://other', sliderId: 9, sliderType: 13, name: 'Kept'}, true, 0);
		const {rows, changed} = reconcileSliderRows(
			[row(1, 14, 'Old'), row(2, 18, 'Gone'), other, {id: 'resume'}],
			[{id: 1, type: 14, title: 'New', enabled: true}, {id: 2, type: 19, title: 'Replaced', enabled: true}],
			server
		);
		expect(changed).toBe(true);
		expect(rows.map((r) => r.name || r.id)).toEqual(['New', 'Kept', 'resume']);
	});
});
