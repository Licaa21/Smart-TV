// The player's controls come up when the viewer presses a key, and the screen that owns them shows them by a state change,
// which on a TV waits for the player (a large component) to draw again before the class that shows them is in place. This
// puts that class on the controls at once, from the key press. The state that follows says the same thing, and when it does
// not (a hide or a dialog in the same press) `concealControlsNow` takes the class off again, since React never removes a
// class it did not put there. Only the video player's own controls are touched (the music player's are marked apart, and so
// are controls that fade to a dimmed look in HDR, which draw their own opacity).
const VIDEO_CONTROLS = '[data-player-controls="video"]';

export const revealControlsNow = (visibleClass, doc = typeof document !== 'undefined' ? document : null) => {
	if (!visibleClass || !doc) return false;
	const root = doc.querySelector(VIDEO_CONTROLS);
	if (!root || root.classList.contains(visibleClass)) return false;
	root.classList.add(visibleClass);
	return true;
};

// [shown] is what the player's state says about the controls by now
export const concealControlsNow = (visibleClass, shown, doc = typeof document !== 'undefined' ? document : null) => {
	if (!visibleClass || !doc || shown) return false;
	const root = doc.querySelector(VIDEO_CONTROLS);
	if (!root || !root.classList.contains(visibleClass)) return false;
	root.classList.remove(visibleClass);
	return true;
};
