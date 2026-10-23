import {defaultSettings} from './defaultSettings';

// What the fork starts a fresh install on, chosen setting by setting (local/default-settings.md). A settings reset gives these.
describe('the fork defaults', () => {
	it('starts on the glass theme with white accents, Romanian, and the left sidebar', () => {
		expect(defaultSettings.visualTheme).toBe('glass');
		['accentNavigation', 'accentHome', 'accentSettings', 'accentSettingsFocus', 'accentAchievements', 'accentDetails',
			'accentPlayer', 'accentSkip', 'accentLiveTv', 'accentOther', 'focusBorderColor'].forEach((key) => expect(defaultSettings[key]).toBe('#ffffff'));
		expect(defaultSettings.uiLanguage).toBe('ro');
		expect(defaultSettings.navbarPosition).toBe('left');
	});

	it('shows these home rows in this order, and every other row off', () => {
		const rows = [...defaultSettings.homeRows].sort((a, b) => a.order - b.order);
		expect(rows.filter((row) => row.enabled).map((row) => row.id)).toEqual([
			'resume', 'nextup', 'latest-media', 'recently-released', 'seasonal', 'imdb-popular-movies', 'imdb-popular-tv',
			'sinceyouwatched1', 'sinceyouwatched2', 'seerr_popular_movies', 'seerr_popular_series', 'seerr_upcoming_movies',
			'seerr_upcoming_series', 'seerr_movie_genres', 'seerr_series_genres', 'seerr_studios', 'seerr_networks',
			'tmdb_trending_movie_weekly', 'tmdb_trending_tv_weekly', 'radarr_calendar', 'sonarr_calendar'
		]);
		expect(rows.slice(0, 21).every((row) => row.enabled)).toBe(true);
		expect(rows.slice(21).some((row) => row.enabled)).toBe(false);
		expect(new Set(rows.map((row) => row.order)).size).toBe(rows.length);
	});

	it('switches on the settings those rows need', () => {
		expect(defaultSettings.seasonalRowEnabled).toBe(true);
		expect(defaultSettings.imdbMostPopularMoviesEnabled).toBe(true);
		expect(defaultSettings.imdbMostPopularTvShowsEnabled).toBe(true);
		expect(defaultSettings.mergeRadarrSonarrCalendars).toBe(true);
	});

	it('ranks the audio codecs and arranges the details and player buttons as chosen', () => {
		expect(defaultSettings.audioCodecOrder).toEqual(['eac3', 'pcm', 'ac3', 'opus', 'vorbis', 'aac', 'mp3', 'flac', 'truehd', 'dtshd', 'dts']);
		expect(defaultSettings.detailButtonOrderTv.slice(0, 11)).toEqual(['seerrRequest', 'playbackInfo', 'audio', 'subtitles', 'trailer', 'watched', 'goToSeries', 'personalRating', 'deleteFiles', 'artwork', 'admin']);
		expect(defaultSettings.hiddenDetailButtonsTv).toHaveLength(10);
		expect(defaultSettings.osdButtonOrderTv.slice(0, 8)).toEqual(['chapters', 'subtitles', 'episodes', 'audio', 'castAndCrew', 'quality', 'sleep', 'info']);
		expect(defaultSettings.hiddenOsdButtonsTv).toEqual(['zoom']);
		expect(defaultSettings.hiddenDetailSectionsTv).toEqual(['moreLikeThis', 'seerrRecommendations']);
	});

	it('lists every rating source, and starts the audio and subtitles in Romanian with English behind', () => {
		expect(defaultSettings.mdblistRatingSources).toHaveLength(12);
		expect([defaultSettings.audioLanguage, defaultSettings.subtitleLanguage]).toEqual(['ron', 'ron']);
		expect([defaultSettings.fallbackAudioLanguage, defaultSettings.fallbackSubtitleLanguage]).toEqual(['eng', 'eng']);
	});
});
