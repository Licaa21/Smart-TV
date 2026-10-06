// A channel key on the seek bar jumps a good deal further than a left or right press, so a long
// film can be crossed in a few seconds of holding it. It is five times the configured step, or a
// slice of the runtime on a long one, whichever is more.
export const CHANNEL_SEEK_MULTIPLIER = 5;
export const CHANNEL_SEEK_FRACTION = 0.03;

export const channelSeekSeconds = (seekStep, durationSeconds) => {
	const step = Number.isFinite(seekStep) && seekStep > 0 ? seekStep : 10;
	const slice = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds * CHANNEL_SEEK_FRACTION : 0;
	return Math.round(Math.max(step * CHANNEL_SEEK_MULTIPLIER, slice));
};
