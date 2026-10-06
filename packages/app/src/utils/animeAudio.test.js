import {audioSettingsFor, hasAnimeLabel} from './animeAudio';

describe('hasAnimeLabel', () => {
	test('finds the label in genres, tags and the series genres', () => {
		expect(hasAnimeLabel({Genres: ['Action', 'Anime']})).toBe(true);
		expect(hasAnimeLabel({Tags: ['anime']})).toBe(true);
		expect(hasAnimeLabel({SeriesGenres: ['ANIME']})).toBe(true);
		expect(hasAnimeLabel({GenreItems: [{Name: 'Anime'}]})).toBe(true);
	});

	test('does not take a genre that only contains the word', () => {
		expect(hasAnimeLabel({Genres: ['Animation']})).toBe(false);
		expect(hasAnimeLabel({})).toBe(false);
		expect(hasAnimeLabel(null)).toBe(false);
	});
});

describe('audioSettingsFor', () => {
	const settings = {audioLanguage: 'eng', fallbackAudioLanguage: 'deu', animeAudioLanguage: 'jpn', animeFallbackAudioLanguage: ''};

	test('anime takes its own language and fallback', () => {
		expect(audioSettingsFor(settings, true)).toMatchObject({audioLanguage: 'jpn', fallbackAudioLanguage: ''});
	});

	test('anything else keeps the default ones', () => {
		expect(audioSettingsFor(settings, false)).toBe(settings);
	});

	test('anime follows the default language while its own is empty', () => {
		const unset = {...settings, animeAudioLanguage: ''};
		expect(audioSettingsFor(unset, true)).toBe(unset);
	});
});
