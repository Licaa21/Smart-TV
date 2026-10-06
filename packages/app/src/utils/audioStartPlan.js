/**
 * Whether the server has to build the audio track a start opens on. AVPlay plays a file from its
 * first audio track, and moving to another one is not dependable on these sets, so any other pick is
 * asked of the server with direct play off. What the first answer was does not matter: on a file
 * whose first track is FLAC the set refuses direct play and the server answers with a remux of that
 * track, and asking again for another track with direct play allowed gets "direct play, track 6"
 * back, which the set then plays from the first track. Nor does the track the server reports as
 * selected, since that only echoes the request.
 * @param {Object} plan
 * @param {Object|null} plan.wanted - the audio stream the start is meant to open on
 * @param {Array} plan.audioStreams - the audio streams of the file, in file order
 * @param {boolean} [plan.forceDirectPlay] - Force Direct Play is on, so the server cannot be asked
 * @param {boolean} [plan.isLiveTV]
 * @returns {boolean}
 */
export const audioStartNeedsServer = ({wanted, audioStreams, forceDirectPlay, isLiveTV}) => {
	const first = audioStreams?.[0];
	return Boolean(wanted && first && !isLiveTV && !forceDirectPlay && wanted.index !== first.index);
};
