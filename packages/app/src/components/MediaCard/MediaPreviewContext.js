import {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {supportsMediaPreview} from '../../services/mediaPreviewSource';

// Browse hands its preview controller down to the home row cards through this.
// Anywhere else renders the same cards without a provider and gets inert handlers,
// so the library, details and Seerr screens never start a preview.
const MediaPreviewContext = createContext(null);

export default MediaPreviewContext;

// What a card needs to take part: the phase it should draw, the ref for the frame
// the video goes into, and the handlers that start and stop the dwell. A pointer
// arriving or leaving counts the same as focus and blur.
export const useMediaPreviewSlot = (previewKey, item) => {
	const controller = useContext(MediaPreviewContext);
	const active = !!controller && !!previewKey && supportsMediaPreview(item);
	const [phase, setPhase] = useState('idle');

	useEffect(() => {
		if (!active) return undefined;
		const unsubscribe = controller.subscribe(previewKey, setPhase);
		return () => {
			unsubscribe();
			controller.cancel(previewKey);
			setPhase('idle');
		};
	}, [controller, previewKey, active]);

	const frameRef = useCallback((el) => {
		if (active) controller.attachFrame(previewKey, el);
	}, [controller, previewKey, active]);

	const onFocus = useCallback(() => {
		if (active) controller.schedule(previewKey, item);
	}, [controller, previewKey, item, active]);

	const onBlur = useCallback(() => {
		if (active) controller.cancel(previewKey);
	}, [controller, previewKey, active]);

	const stopForSelect = useCallback(() => {
		if (active) controller.stop('select');
	}, [controller, active]);

	return {phase, frameRef, onFocus, onBlur, stopForSelect};
};
