import {languageMatches} from './audioLanguage';
import {AUDIO_CODECS, audioCodecKey} from './audioCodecs';
import {ordered} from './buttonLayout';
import {streamTitleText} from './streamTitle';

// Picks the audio track a fresh playback starts on, following the same order the
// other clients follow: an explicit pick, then commentary and audio description
// filtered out, then the default track shortcut, then preferred language,
// fallback language and English, each of those preferring the track the viewer
// last chose by hand before ranking what is left.

const COMMENTARY = /\b(commentary|director\s*commentary|commentaries|directors\s*commentary)\b/;
const AUDIO_DESCRIPTION = /\b(audio\s+description|descriptive\s+audio|visual\s+description|descriptive|description|ad)\b/;

// A raw server record in the shape the player holds, so the details screen can ask
// selectPreferredAudioStream the same question the player will and show the same answer.
export const fromServerAudio = (stream) => ({
	index: stream?.Index,
	codec: stream?.Codec,
	profile: stream?.Profile,
	language: stream?.Language || 'Unknown',
	title: stream?.Title,
	displayTitle: stream?.DisplayTitle || stream?.Title || stream?.Language,
	channels: stream?.Channels,
	isDefault: stream?.IsDefault,
	isAudioDescription: stream?.IsAudioDescription
});

export const isCommentaryAudioStream = (stream) =>
	stream?.isCommentary === true || COMMENTARY.test(streamTitleText(stream));

export const isAudioDescriptionAudioStream = (stream) =>
	stream?.isAudioDescription === true || stream?.IsAudioDescription === true ||
	AUDIO_DESCRIPTION.test(streamTitleText(stream));

const trackTitle = (stream) => String(stream?.title || stream?.displayTitle || '').trim().toLowerCase();

const channelsOf = (stream) => (typeof stream?.channels === 'number' ? stream.channels : 0);

// A codec the viewer's order does not name ranks after every one it does.
const codecRank = (stream, order) => {
	const position = order.indexOf(audioCodecKey(stream));
	return position < 0 ? order.length : position;
};

// The codec order and surround then settle what language and the two flags leave
// tied. The default flag moves above or below them depending on whether the viewer
// asked for default tracks.
const rankAudioCandidates = (candidates, prefs) => {
	if (candidates.length <= 1) return candidates[0];
	const {preferDefaultAudioTrack, preferAudioDescription, codecOrder} = prefs;
	return candidates.slice().sort((a, b) => {
		if (preferAudioDescription) {
			const aAd = isAudioDescriptionAudioStream(a);
			const bAd = isAudioDescriptionAudioStream(b);
			if (aAd !== bAd) return aAd ? -1 : 1;
		}
		if (preferDefaultAudioTrack) {
			const aDefault = a.isDefault === true;
			const bDefault = b.isDefault === true;
			if (aDefault !== bDefault) return aDefault ? -1 : 1;
		}
		if (codecOrder) {
			const aRank = codecRank(a, codecOrder);
			const bRank = codecRank(b, codecOrder);
			if (aRank !== bRank) return aRank - bRank;
		}
		const aChannels = channelsOf(a);
		const bChannels = channelsOf(b);
		if (aChannels !== bChannels) return bChannels - aChannels;
		if (!preferDefaultAudioTrack) {
			const aDefault = a.isDefault === true;
			const bDefault = b.isDefault === true;
			if (aDefault !== bDefault) return aDefault ? -1 : 1;
		}
		return (a.index || 0) - (b.index || 0);
	})[0];
};

// Within one language, the track the viewer picked last time wins, first by its
// own index and then by its name, which survives a file listing its tracks in a
// different order.
const preferRemembered = (matches, prefs) => {
	const {lastIndex, lastTitle} = prefs;
	if (lastIndex !== null && lastIndex !== undefined) {
		const byIndex = matches.find((stream) => stream.index === lastIndex);
		if (byIndex) return byIndex;
	}
	if (lastTitle) {
		const byTitle = matches.find((stream) => trackTitle(stream) === lastTitle);
		if (byTitle) return byTitle;
	}
	return rankAudioCandidates(matches, prefs);
};

/**
 * @param {Array} audioStreams - the audio tracks the source offers
 * @param {Object} [settings] - audioLanguage, fallbackAudioLanguage,
 *   preferDefaultAudioTrack, preferAudioDescription, audioCodecOrder (codec ids, best
 *   first; without one tracks rank by channel count alone), and optionally
 *   explicitAudioIndex, lastExplicitAudioIndex and lastExplicitAudioTitle
 * @returns {Object|null} the track to start on
 */
export const selectPreferredAudioStream = (audioStreams, settings = {}) => {
	if (!Array.isArray(audioStreams) || audioStreams.length === 0) return null;

	const {
		audioLanguage,
		fallbackAudioLanguage,
		preferDefaultAudioTrack = false,
		preferAudioDescription = false,
		audioCodecOrder,
		explicitAudioIndex,
		lastExplicitAudioIndex,
		lastExplicitAudioTitle
	} = settings;

	if (explicitAudioIndex !== null && explicitAudioIndex !== undefined) {
		const explicit = audioStreams.find((stream) => stream.index === explicitAudioIndex);
		if (explicit) return explicit;
	}

	let candidates = audioStreams.filter((stream) => !isCommentaryAudioStream(stream));
	if (!candidates.length) candidates = audioStreams;

	if (!preferAudioDescription) {
		const withoutAd = candidates.filter((stream) => !isAudioDescriptionAudioStream(stream));
		if (withoutAd.length) candidates = withoutAd;
	}

	const prefs = {
		preferDefaultAudioTrack,
		preferAudioDescription,
		codecOrder: audioCodecOrder ? ordered(AUDIO_CODECS, audioCodecOrder).map((codec) => codec.id) : null,
		lastIndex: lastExplicitAudioIndex,
		lastTitle: lastExplicitAudioTitle ? String(lastExplicitAudioTitle).trim().toLowerCase() : ''
	};

	if (preferDefaultAudioTrack) {
		const defaults = candidates.filter((stream) => stream.isDefault === true);
		if (defaults.length) return rankAudioCandidates(defaults, prefs);
	}

	for (const language of [audioLanguage, fallbackAudioLanguage, 'eng']) {
		const matches = candidates.filter((stream) => languageMatches(stream.language, language));
		if (matches.length) return preferRemembered(matches, prefs);
	}

	return rankAudioCandidates(candidates, prefs);
};
