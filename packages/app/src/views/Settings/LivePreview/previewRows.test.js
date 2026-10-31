import {defaultSettings} from '../../../context/defaultSettings';
import {SCENE_BY_KEY, MEDIA_BAR_KEYS, describeRow} from './previewRows';

describe('settings live preview rows', () => {
	test('every previewed setting is a real setting', () => {
		Object.keys(SCENE_BY_KEY).forEach((key) => {
			expect(defaultSettings).toHaveProperty(key);
		});
		MEDIA_BAR_KEYS.forEach((key) => {
			expect(SCENE_BY_KEY[key]).toBe('home');
		});
	});

	test('a picker row lists its choices with the saved one marked', () => {
		const row = describeRow('setting-navbarPosition', {...defaultSettings, navbarPosition: 'left'});
		expect(row.key).toBe('navbarPosition');
		expect(row.scene).toBe('home');
		expect(row.options.map((option) => option.value)).toEqual(['top', 'left']);
		expect(row.saved).toBe(1);
	});

	test('a switch names its scene and offers no choices', () => {
		const row = describeRow('setting-showDescriptionOnPause', defaultSettings);
		expect(row.scene).toBe('player');
		expect(row.options).toEqual([]);
	});

	test('rows the preview doesn\'t draw still describe themselves', () => {
		const row = describeRow('setting-alwaysAuthenticate', defaultSettings);
		expect(row.title).toBeTruthy();
		expect(row.scene).toBeNull();
	});

	test('category and unknown ids', () => {
		expect(describeRow('cat-account', defaultSettings).title).toBeTruthy();
		expect(describeRow('not-a-row', defaultSettings)).toBeNull();
		expect(describeRow(null, defaultSettings)).toBeNull();
	});
});
