import Spotlight from '@enact/spotlight';

// The audio player's vertical focus chain. Up from the seekbar walks into the
// queue or lyrics panel, and once inside, the panel's rows own up and down, so
// left, back or down past the last row leaves it again. The dock row keeps the
// shared player's "bottom" name so the existing controls stay focusable without
// a special case.
const CHAIN = ['panel', 'progress', 'bottom'];

const AUDIO_FOCUS_IDS = {
	panel: 'audio-panel',
	progress: 'progress-bar',
	bottom: 'play-pause-btn'
};

// The queue marks the playing track and the lyrics the active line, which is
// where the panel takes focus when it's entered.
const PANEL_ENTRY = '[data-spotlight-id="audio-panel"] [data-panel-entry]';

// Coming back down to the dock lands on the button it was left from. It's noted as
// the remote leaves, since Spotlight's own move down focuses Play/Pause first.
let dockAction = null;
export const noteDockFocus = () => {
	dockAction = document.activeElement?.dataset?.action || dockAction;
};
export const forgetDockFocus = () => {
	dockAction = null;
};

export const nextAudioFocusRow = (current, direction) => {
	const index = CHAIN.indexOf(current);
	if (index < 0) return current;
	const next = index + (direction === 'up' ? -1 : 1);
	if (next < 0 || next >= CHAIN.length) return current;
	return CHAIN[next];
};

// The row has to stop being spotlightDisabled before it can take focus, so the
// focus call waits for the render that clears it.
export const focusAudioRow = (row) => {
	window.requestAnimationFrame(() => {
		if (row === 'panel' && Spotlight.focus(PANEL_ENTRY)) return;
		if (row === 'bottom' && dockAction && Spotlight.focus(`[data-action="${dockAction}"]`)) return;
		Spotlight.focus(AUDIO_FOCUS_IDS[row]);
	});
};

export const exitAudioPanel = (setFocusRow) => {
	setFocusRow('progress');
	focusAudioRow('progress');
};

const isLastPanelRow = () => {
	const rows = document.querySelectorAll('[data-spotlight-id="audio-panel"] .spottable');
	return rows.length > 0 && document.activeElement === rows[rows.length - 1];
};

// Walks the chain for both players. Returns true when the key was the audio
// player's to handle, which is every key while the panel holds focus since its
// own rows answer up and down.
export const handleAudioFocusKey = (e, {focusRow, setFocusRow, showControls}) => {
	const isUp = e.key === 'ArrowUp' || e.keyCode === 38;
	const isDown = e.key === 'ArrowDown' || e.keyCode === 40;

	if (focusRow === 'panel') {
		if (e.key === 'ArrowLeft' || e.keyCode === 37 || (isDown && isLastPanelRow())) {
			e.preventDefault();
			exitAudioPanel(setFocusRow);
		}
		return true;
	}

	if (isUp || isDown) {
		e.preventDefault();
		showControls();
		const next = nextAudioFocusRow(focusRow, isUp ? 'up' : 'down');
		// Down from the dock has nowhere to go, so focus stays on its button.
		if (next === focusRow) return true;
		if (focusRow === 'bottom') noteDockFocus();
		setFocusRow(next);
		focusAudioRow(next);
		return true;
	}

	return false;
};
