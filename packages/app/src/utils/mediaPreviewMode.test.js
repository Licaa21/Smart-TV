import {mediaPreviewMode, mediaPreviewSettings} from './mediaPreviewMode';

describe('mediaPreviewMode', () => {
	test('the switch being off wins over any mode', () => {
		expect(mediaPreviewMode({episodePreviewEnabled: false, mediaPreviewMode: 'trailer'})).toBe('off');
		expect(mediaPreviewMode({mediaPreviewMode: 'media'})).toBe('off');
		expect(mediaPreviewMode(null)).toBe('off');
	});

	test('a switch that is on plays trailers only when asked to', () => {
		expect(mediaPreviewMode({episodePreviewEnabled: true, mediaPreviewMode: 'trailer'})).toBe('trailer');
		expect(mediaPreviewMode({episodePreviewEnabled: true, mediaPreviewMode: 'media'})).toBe('media');
	});

	test('a profile from before the mode lands on Media Preview', () => {
		expect(mediaPreviewMode({episodePreviewEnabled: true})).toBe('media');
		// An older app turning the switch back on after Off was picked here
		expect(mediaPreviewMode({episodePreviewEnabled: true, mediaPreviewMode: 'off'})).toBe('media');
	});
});

describe('mediaPreviewSettings', () => {
	test('writes the switch and the mode together', () => {
		expect(mediaPreviewSettings('off')).toEqual({episodePreviewEnabled: false, mediaPreviewMode: 'off'});
		expect(mediaPreviewSettings('media')).toEqual({episodePreviewEnabled: true, mediaPreviewMode: 'media'});
		expect(mediaPreviewSettings('trailer')).toEqual({episodePreviewEnabled: true, mediaPreviewMode: 'trailer'});
	});
});
