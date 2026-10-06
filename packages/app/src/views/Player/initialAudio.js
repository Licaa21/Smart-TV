import {getSeriesAudioPref} from '../../services/subtitlePrefs';
import {matchSeriesTrackIndex} from '../../utils/seriesTrackPrefs';

/**
 * The audio track remembered for this series, when one of the episode's own tracks
 * can still be it. Null leaves the choice to the language preferences, which is also what a
 * viewer who turned remembering off gets.
 */
export const resolveSeriesAudio = async (item, audioStreams, enabled = true) => {
	if (!enabled || !item?.SeriesId || !audioStreams?.length) return null;

	const pref = await getSeriesAudioPref(item.SeriesId);
	if (!pref) return null;

	const matched = matchSeriesTrackIndex(audioStreams, pref);
	if (matched === null || matched < 0) return null;

	return audioStreams.find((stream) => stream.index === matched) || null;
};
