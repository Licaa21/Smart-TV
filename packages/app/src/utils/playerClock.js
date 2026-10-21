// Whether the player has to redraw for a new playback time. Only the controls, an open modal and the
// lyrics of a song read it, and every update redraws the whole player twice a second, which is enough to
// make a key press wait its turn, so while nothing on screen shows the time the redraw is skipped. The
// first one after the controls come back catches up. It is the same on every performance level: Ultra
// felt the key presses wait where Medium did not.
export const playerClockWanted = ({controlsVisible, activeModal, isAudioMode}) =>
	Boolean(controlsVisible) || Boolean(activeModal) || Boolean(isAudioMode);

// The clock reads in whole seconds, so it is redrawn once a second rather than on every half second
// reading, which a key press feels. A song's lyrics follow it more closely than that.
export const playerClockStale = ({time, shownSecond, isAudioMode = false}) =>
	isAudioMode || Math.floor(time) !== shownSecond;
