import {volumeLevel} from './volumeLevel';

describe('volumeLevel', () => {
	test('turns the 0 to 100 setting into a media element volume', () => {
		expect(volumeLevel(100)).toBe(1);
		expect(volumeLevel(35)).toBe(0.35);
		expect(volumeLevel(0)).toBe(0);
	});

	test('keeps out of range values inside 0 to 1', () => {
		expect(volumeLevel(150)).toBe(1);
		expect(volumeLevel(-5)).toBe(0);
	});

	test('plays at full volume when the setting is missing', () => {
		expect(volumeLevel(undefined)).toBe(1);
	});
});
