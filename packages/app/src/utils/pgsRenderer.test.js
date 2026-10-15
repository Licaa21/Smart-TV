import {pgsDrawnArea} from './pgsRenderer';

jest.mock('./mkvPgsSource', () => ({}));

const canvas = {width: 1920, height: 1080};
const drawn = (area) => ({implementation: {renderer: {dirtyArea: {empty: false, ...area}}}});

describe('pgsDrawnArea', () => {
	it('reads where the renderer drew, as fractions of the canvas, from wherever the library keeps it', () => {
		const renderer = drawn({x: 480, y: 810, width: 960, height: 108});
		expect(pgsDrawnArea(renderer, canvas)).toEqual({left: 0.25, top: 0.75, width: 0.5, height: 0.1});
	});

	it('says nothing when nothing is drawn, or when the renderer or canvas is missing', () => {
		expect(pgsDrawnArea({implementation: {renderer: {dirtyArea: {empty: true, x: 0, y: 0, width: 0, height: 0}}}}, canvas)).toBeNull();
		expect(pgsDrawnArea({implementation: {}}, canvas)).toBeNull();
		expect(pgsDrawnArea(null, canvas)).toBeNull();
		expect(pgsDrawnArea(drawn({x: 0, y: 0, width: 10, height: 10}), {width: 0, height: 0})).toBeNull();
	});

	it('follows the renderer as it clears and draws again', () => {
		const renderer = drawn({x: 0, y: 0, width: 192, height: 108});
		expect(pgsDrawnArea(renderer, canvas)).not.toBeNull();
		Object.assign(renderer.implementation.renderer.dirtyArea, {empty: true, width: 0, height: 0});
		expect(pgsDrawnArea(renderer, canvas)).toBeNull();
		Object.assign(renderer.implementation.renderer.dirtyArea, {empty: false, x: 96, y: 54, width: 192, height: 108});
		expect(pgsDrawnArea(renderer, canvas)).toEqual({left: 0.05, top: 0.05, width: 0.1, height: 0.1});
	});
});
