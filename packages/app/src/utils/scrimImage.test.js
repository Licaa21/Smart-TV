import {scrimStyle} from './scrimImage';

// Records what the helper draws, since jsdom has no 2D canvas of its own.
const recorder = () => {
	const calls = [];
	const gradient = (args) => {
		const g = {args, stops: [], addColorStop: (offset, color) => g.stops.push([offset, color])};
		return g;
	};
	const ctx = {
		save: () => {},
		restore: () => {},
		translate: (x, y) => calls.push(['translate', x, y]),
		scale: (x, y) => calls.push(['scale', x, y]),
		createLinearGradient: (...args) => gradient(args),
		createRadialGradient: (...args) => gradient(args),
		fillRect: (...args) => calls.push(['fill', ctx.fillStyle, args])
	};
	return {ctx, calls};
};

const supportsCustomProperties = (yes) => {
	Object.defineProperty(window, 'CSS', {value: {supports: () => yes}, configurable: true});
};

let rec;
beforeEach(() => {
	rec = recorder();
	jest.spyOn(window.HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => rec.ctx);
	jest.spyOn(window.HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:baked');
	supportsCustomProperties(true);
});

afterEach(() => {
	jest.restoreAllMocks();
	delete window.CSS;
});

describe('scrimStyle', () => {
	test('paints the bottom layer first and stretches the result over the box', () => {
		const layers = [
			{to: 'top', rgb: '11, 13, 16', stops: [[0, 1], [0.8, 0]]},
			{to: 'right', rgb: '0, 0, 0', stops: [[0, 0.5]]}
		];
		expect(scrimStyle(layers)).toEqual({
			backgroundImage: 'url(data:baked)', backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat'
		});
		const fills = rec.calls.filter((c) => c[0] === 'fill');
		expect(fills.map((f) => f[1].args)).toEqual([[0, 0, 240, 0], [0, 135, 0, 0]]);
		expect(fills[1][1].stops).toEqual([[0, 'rgba(11, 13, 16, 1)'], [0.8, 'rgba(11, 13, 16, 0)']]);
	});

	test('sizes an ellipse to its farthest corner and covers the whole canvas with it', () => {
		scrimStyle([{at: [0.75, 0.25], rgb: '0, 0, 0', stops: [[0, 0], [1, 0.45]]}]);
		const rx = 180 * Math.SQRT2;
		const squash = (101.25 * Math.SQRT2) / rx;
		expect(rec.calls[0]).toEqual(['translate', 180, 33.75]);
		expect(rec.calls[1]).toEqual(['scale', 1, squash]);
		const [, gradient, rect] = rec.calls[2];
		expect(gradient.args).toEqual([0, 0, 0, 0, 0, rx]);
		expect(rect).toEqual([-180, -33.75 / squash, 240, 135 / squash]);
	});

	test('scales every alpha, and a stop can bring its own color', () => {
		scrimStyle([{to: 'bottom', rgb: '11, 4, 32', stops: [[0, 1], [0.4, 0.55, '30, 10, 63']]}], 0.608);
		expect(rec.calls[0][1].stops).toEqual([[0, 'rgba(11, 4, 32, 0.608)'], [0.4, 'rgba(30, 10, 63, 0.334)']]);
	});

	test('keeps the unscaled image where the stylesheet keeps the unscaled pass', () => {
		supportsCustomProperties(false);
		scrimStyle([{to: 'top', rgb: '0, 0, 0', stops: [[0, 0.5]]}], 0.3);
		expect(rec.calls[0][1].stops).toEqual([[0, 'rgba(0, 0, 0, 0.5)']]);
	});

	test('draws each scrim and scale once', () => {
		const layers = [{to: 'top', rgb: '0, 0, 0', stops: [[0, 1]]}];
		const first = scrimStyle(layers, 0.5);
		expect(scrimStyle(layers, 0.5)).toBe(first);
		expect(rec.calls.filter((c) => c[0] === 'fill')).toHaveLength(1);
		scrimStyle(layers, 0.6);
		expect(rec.calls.filter((c) => c[0] === 'fill')).toHaveLength(2);
	});

	test('leaves the stylesheet gradients in place without a 2D canvas', () => {
		window.HTMLCanvasElement.prototype.getContext.mockReturnValue(null);
		expect(scrimStyle([{to: 'top', rgb: '0, 0, 0', stops: [[0, 1]]}])).toBeNull();
	});
});
