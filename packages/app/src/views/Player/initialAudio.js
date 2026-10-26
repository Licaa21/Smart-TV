import {getItemAudioPref, getSeriesAudioPref} from '../../services/subtitlePrefs';
import {matchSeriesTrackIndex} from '../../utils/seriesTrackPrefs';

/**
 * The audio track remembered for this title, or else for its series when one of the
 * episode's own tracks can still be it. Null leaves the choice to the language preferences.
 */
export const resolveSeriesAudio = async (item, audioStreams) => {
	if (!item?.Id || !audioStreams?.length) return null;

	const itemIndex = await getItemAudioPref(item.Id);
	const itemTrack = itemIndex != null ? audioStreams.find((stream) => stream.index === itemIndex) : null;
	if (itemTrack) return itemTrack;
	if (!item.SeriesId) return null;

	const pref = await getSeriesAudioPref(item.SeriesId);
	if (!pref) return null;

	const matched = matchSeriesTrackIndex(audioStreams, pref);
	if (matched === null || matched < 0) return null;

	return audioStreams.find((stream) => stream.index === matched) || null;
};
