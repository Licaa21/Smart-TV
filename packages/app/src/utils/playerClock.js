// Whether the player has to redraw for a new playback time. Only the controls, an open modal and the
// lyrics of a song read it, and every update redraws the whole player twice a second. On the sets
// the Medium level and below are for, that is enough to make a key press wait its turn, so while
// nothing on screen shows the time the redraw is skipped. The first one after the controls come back
// catches up.
export const playerClockWanted = ({tier, controlsVisible, activeModal, isAudioMode}) =>
	tier === 'high' || Boolean(controlsVisible) || Boolean(activeModal) || Boolean(isAudioMode);

// The clock reads in whole seconds, so on a slow set it is redrawn once a second rather than on every
// half second reading, which the sets that need this feel in their key presses. A song's lyrics follow
// it more closely than that.
export const playerClockStale = ({tier, time, shownSecond, isAudioMode = false}) =>
	tier === 'high' || isAudioMode || Math.floor(time) !== shownSecond;
