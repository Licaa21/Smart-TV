import {useCallback, useEffect, useRef, useState} from 'react';

// Longer than a remote takes to start repeating a held key, so a longer wait means the hold ended
// even if its key up never arrived.
const HOLD_GAP_MS = 1000;

// The set step for the first three moves of a hold, then 30 s up to the eighth, 60 s up to the
// sixteenth and 180 s after that, never less than the set step.
export const holdSeekSeconds = (baseSeconds, count) => {
	const tier = count <= 3 ? 0 : count <= 8 ? 30 : count <= 16 ? 60 : 180;
	return Math.max(baseSeconds, tier);
};

// Seeking speeds up while a key is held. The hold is counted from key downs with no key up between
// them rather than KeyboardEvent.repeat, which the oldest sets dont report. A key up, a turn the
// other way or a pause starts it over, so separate presses always move the set step.
//
// stepBy gives each press its signed move, and stepSeconds is how far the next one goes, which the
// trickplay preview spaces its thumbnails by.
const useHeldSeekStep = (baseSeconds) => {
	const holdRef = useRef({count: 0, direction: 0, at: 0});
	const [nextStep, setNextStep] = useState(null);

	useEffect(() => {
		const release = () => {
			holdRef.current.count = 0;
			setNextStep(null);
		};
		window.addEventListener('keyup', release, true);
		return () => window.removeEventListener('keyup', release, true);
	}, []);

	const stepBy = useCallback((direction) => {
		const hold = holdRef.current;
		const now = Date.now();
		const count = hold.count > 0 && hold.direction === direction && now - hold.at < HOLD_GAP_MS ? hold.count + 1 : 1;
		holdRef.current = {count, direction, at: now};
		setNextStep(holdSeekSeconds(baseSeconds, count + 1));
		return direction * holdSeekSeconds(baseSeconds, count);
	}, [baseSeconds]);

	return {stepBy, stepSeconds: nextStep ?? baseSeconds};
};

export default useHeldSeekStep;
