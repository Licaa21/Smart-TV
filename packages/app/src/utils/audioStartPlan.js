// The streams are the player's own (index, codec) or the server's (Index, Codec).
const indexOf = (stream) => stream?.index ?? stream?.Index;
const codecOf = (stream) => String(stream?.codec ?? stream?.Codec ?? '').toLowerCase();

/**
 * The track AVPlay opens a file on: the first one the set can decode, which for a file that starts on
 * TrueHD is not the first one in the file. AVPlay leaves what it cannot decode out of its own list.
 * @param {Array} audioStreams - the audio streams of the file, in file order
 * @param {Function} [canDecode] - whether the set decodes a stream, true for all when left out
 * @returns {Object|null}
 */
export const openingAudioStream = (audioStreams, canDecode = () => true) =>
	(audioStreams || []).find((stream) => canDecode(stream)) || audioStreams?.[0] || null;

/**
 * Whether the server has to build the audio track a start opens on. AVPlay plays a file from the track
 * it opens on, and moving to another one is not dependable across codecs on these sets: a switch from
 * FLAC to AC3 failed after the switch or was never applied, while one from AC3 5.1 to AC3 2.0 took. So a
 * pick in the codec the player opens on is left to the player, whose switch is checked after play, and
 * any other is asked of the server with direct play off. What the first answer was does not matter: on a
 * file whose first track is FLAC the set refuses direct play and the server answers with a remux of that
 * track, and asking again for another track with direct play allowed gets "direct play, track 6" back,
 * which the set then plays from the first track. Nor does the track the server reports as selected, since
 * that only echoes the request.
 * @param {Object} plan
 * @param {Object|null} plan.wanted - the audio stream the start is meant to open on
 * @param {Array} plan.audioStreams - the audio streams of the file, in file order
 * @param {Function} [plan.canDecode] - whether the set decodes a stream
 * @param {boolean} [plan.allowSameCodec] - a pick in the opening codec is left to the player. Only a start has a
 *   native switch queued for it, so a reload, which has none, leaves this off and builds the track
 * @param {boolean} [plan.forceDirectPlay] - Force Direct Play is on, so the server cannot be asked
 * @param {boolean} [plan.isLiveTV]
 * @returns {boolean}
 */
export const audioStartNeedsServer = ({wanted, audioStreams, canDecode, allowSameCodec = false, forceDirectPlay, isLiveTV}) => {
	const opening = openingAudioStream(audioStreams, canDecode);
	if (!wanted || !opening || isLiveTV || forceDirectPlay) return false;
	if (indexOf(wanted) === indexOf(opening)) return false;
	return !allowSameCodec || codecOf(wanted) !== codecOf(opening);
};
