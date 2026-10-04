import {channelSeekSeconds} from './channelSeek';

describe('channelSeekSeconds', () => {
	test('is five times the step on a short video', () => {
		expect(channelSeekSeconds(10, 600)).toBe(50);
		expect(channelSeekSeconds(30, 600)).toBe(150);
	});

	test('scales with the runtime on a long one, so the whole film takes about thirty presses', () => {
		expect(channelSeekSeconds(10, 7200)).toBe(216);
	});

	test('falls back to a ten second step when the setting is missing', () => {
		expect(channelSeekSeconds(undefined, 0)).toBe(50);
		expect(channelSeekSeconds(0, NaN)).toBe(50);
	});
});
