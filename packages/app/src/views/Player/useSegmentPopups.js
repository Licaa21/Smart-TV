import {useState, useEffect, useCallback, useRef} from 'react';
import Spotlight from '@enact/spotlight';
import {isBackKey} from '../../utils/keys';
import {shouldAskStillWatching} from '../../utils/stillWatching';

// The next episode is offered once this little of the current one is left.
const NEAR_END_TICKS = 300000000;

// The position is read twice a second, so a reading that is further from the last than this, forward, or any real step
// back, is a seek and not playback.
const SEEK_FORWARD_TICKS = 30000000;
const SEEK_BACK_TICKS = 10000000;

// The prompt's own button, which the key handler tells apart from the controls underneath.
// How long after a skip a reading short of the segment's end is still the skip landing.
const SKIP_SETTLE_MS = 5000;

export const SKIP_PROMPT_ID = 'skip-segment-btn';
const onSkipPrompt = () => {
	const active = typeof document !== 'undefined' ? document.activeElement : null;
	return Boolean(active && active.closest && active.closest(`[data-spotlight-id="${SKIP_PROMPT_ID}"]`));
};

/**
 * Drives the skip prompt for any segment the server marked up, plus the credits
 * and next episode prompts that follow an episode into the one after it.
 */
const useSegmentPopups = ({
	mediaSegments,
	nextEpisode,
	settings,
	runTimeRef,
	activeModal,
	controlsVisible,
	hideControls,
	showControls,
	onSeekToSegmentEnd,
	// With the controls up, Up from the playback bar reaches the prompt and Down from it goes back.
	focusRow,
	onLeavePromptDown,
	onPlayNext,
	onPausePlayback,
	onStopPlayback,
	// A pre-roll runs straight into the feature, so it gets no credits or next-up prompt.
	currentIsPreroll = false
}) => {
	// The segment being offered right now, as {type, start, end, remainingSeconds, progress}.
	const [skipSegment, setSkipSegment] = useState(null);
	const [showSkipCredits, setShowSkipCredits] = useState(false);
	const [showNextEpisode, setShowNextEpisode] = useState(false);
	const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(null);
	// Only counts episodes that started themselves. Any sign of the viewer at the
	// remote, a seek, a skip, play or pause, or choosing the next one by hand,
	// answers the question the prompt was going to ask.
	const [askStillWatching, setAskStillWatching] = useState(false);
	const consecutiveRef = useRef(0);
	const noteViewerActivity = useCallback(() => {
		consecutiveRef.current = 0;
	}, []);

	const dismissedSegmentsRef = useRef(new Set());
	// The last position checked, to tell a seek from playback.
	const lastTicksRef = useRef(null);
	// The segment just skipped, since the seek that skips it can land a little short of its end and must not read as a
	// viewer's seek into it.
	const skippedRef = useRef(null);
	// When the current skip prompt first appeared, for the auto hide timer.
	const promptShownAtRef = useRef(null);
	// Mirrored so the skip handler can stay stable, because the players keep
	// checkSegments in a dependency array and it must not change every second.
	const skipSegmentRef = useRef(null);
	useEffect(() => {
		skipSegmentRef.current = skipSegment;
	}, [skipSegment]);
	const hasTriggeredNextEpisodeRef = useRef(false);
	const nextEpisodeTimerRef = useRef(null);
	const nextEpisodeTimeoutRef = useRef(null);

	// --- Countdown ---

	const cancelNextEpisodeCountdown = useCallback(() => {
		if (nextEpisodeTimerRef.current) {
			clearInterval(nextEpisodeTimerRef.current);
			nextEpisodeTimerRef.current = null;
		}
		if (nextEpisodeTimeoutRef.current) {
			clearTimeout(nextEpisodeTimeoutRef.current);
			nextEpisodeTimeoutRef.current = null;
		}
		hasTriggeredNextEpisodeRef.current = true;
		setNextEpisodeCountdown(null);
		setShowNextEpisode(false);
		setShowSkipCredits(false);
	}, []);

	// The automatic path. A long enough run of these is what raises the prompt.
	const handlePlayNextEpisode = useCallback(async () => {
		if (!nextEpisode || !onPlayNext) return;
		cancelNextEpisodeCountdown();
		if (shouldAskStillWatching(consecutiveRef.current, settings.stillWatchingBehavior)) {
			// The current episode is still running underneath, and the prompt says
			// playback has been paused, so it has to actually be paused.
			onPausePlayback?.();
			setAskStillWatching(true);
			return;
		}
		consecutiveRef.current += 1;
		await onPlayNext(nextEpisode);
	}, [nextEpisode, onPlayNext, onPausePlayback, cancelNextEpisodeCountdown, settings.stillWatchingBehavior]);

	// Pressing Play Next answers the question, so the run starts over.
	const handlePlayNextNow = useCallback(async () => {
		if (!nextEpisode || !onPlayNext) return;
		cancelNextEpisodeCountdown();
		consecutiveRef.current = 0;
		await onPlayNext(nextEpisode);
	}, [nextEpisode, onPlayNext, cancelNextEpisodeCountdown]);

	const handleStillWatchingContinue = useCallback(async () => {
		setAskStillWatching(false);
		consecutiveRef.current = 0;
		if (nextEpisode && onPlayNext) await onPlayNext(nextEpisode);
	}, [nextEpisode, onPlayNext]);

	const handleStillWatchingStop = useCallback(() => {
		setAskStillWatching(false);
		consecutiveRef.current = 0;
		onStopPlayback?.();
	}, [onStopPlayback]);

	const startNextEpisodeCountdown = useCallback(() => {
		if (nextEpisodeTimeoutRef.current) return;

		const timeout = settings.nextUpTimeout ?? 7;
		if (timeout === 0) {
			handlePlayNextEpisode();
			return;
		}
		setNextEpisodeCountdown(timeout);

		nextEpisodeTimeoutRef.current = setTimeout(() => {
			nextEpisodeTimeoutRef.current = null;
			handlePlayNextEpisode();
		}, timeout * 1000);

		// Both the timer text and the ring read this, so it ticks whichever the
		// viewer has chosen to see.
		let countdown = timeout;
		nextEpisodeTimerRef.current = setInterval(() => {
			countdown--;
			setNextEpisodeCountdown(countdown);
			if (countdown <= 0) {
				clearInterval(nextEpisodeTimerRef.current);
				nextEpisodeTimerRef.current = null;
			}
		}, 1000);
	}, [handlePlayNextEpisode, settings.nextUpTimeout]);

	// --- Skip segment ---

	// The auto skip path passes the segment it matched. A button press hands this
	// its own click event instead, so anything without an end tick falls back to
	// whichever segment is on screen.
	const handleSkipSegment = useCallback((segment) => {
		const pressed = segment?.end == null;
		const target = pressed ? skipSegmentRef.current : segment;
		if (!target?.end) return;
		if (pressed) noteViewerActivity();
		dismissedSegmentsRef.current.add(target.start);
		skippedRef.current = {start: target.start, at: Date.now()};
		onSeekToSegmentEnd?.(target.end);
		setSkipSegment(null);
	}, [noteViewerActivity, onSeekToSegmentEnd]);

	// --- Reset on new media ---

	const resetPopups = useCallback(() => {
		setSkipSegment(null);
		setShowSkipCredits(false);
		setShowNextEpisode(false);
		setNextEpisodeCountdown(null);
		setAskStillWatching(false);
		dismissedSegmentsRef.current.clear();
		lastTicksRef.current = null;
		skippedRef.current = null;
		hasTriggeredNextEpisodeRef.current = false;
		if (nextEpisodeTimerRef.current) {
			clearInterval(nextEpisodeTimerRef.current);
			nextEpisodeTimerRef.current = null;
		}
		if (nextEpisodeTimeoutRef.current) {
			clearTimeout(nextEpisodeTimeoutRef.current);
			nextEpisodeTimeoutRef.current = null;
		}
	}, []);

	// --- Segment checking (call from timeupdate) ---

	const checkSegments = useCallback((ticks) => {
		const introAction = settings.introAction || 'ask';
		const outroAction = settings.outroAction || 'ask';
		const creditsStart = mediaSegments?.creditsStart ?? null;

		// A seek into a segment offers it again, however the prompt for it ended before: dismissed, or hidden after its
		// few seconds. A segment that skips by itself is left as it is, so winding back into an intro to watch it does
		// not throw the viewer straight out again. The progress is worked out from where the seek landed.
		const last = lastTicksRef.current;
		lastTicksRef.current = ticks;
		if (last != null && (ticks - last > SEEK_FORWARD_TICKS || last - ticks > SEEK_BACK_TICKS)) {
			(mediaSegments?.list || []).forEach((seg) => {
				if (seg.end == null || ticks < seg.start || ticks >= seg.end) return;
				if (skippedRef.current?.start === seg.start && Date.now() - skippedRef.current.at < SKIP_SETTLE_MS) return;
				const auto = (seg.type === 'intro' && introAction === 'auto') || (seg.type === 'outro' && outroAction === 'auto');
				if (auto) return;
				dismissedSegmentsRef.current.delete(seg.start);
				if (promptShownAtRef.current?.start === seg.start) promptShownAtRef.current = null;
			});
		}

		// Seeking back past where a prompt would first appear makes it upcoming
		// again, so one that was skipped or dismissed on the way through is offered
		// once more rather than staying hidden for the rest of the episode.
		for (const start of dismissedSegmentsRef.current) {
			if (ticks < start) dismissedSegmentsRef.current.delete(start);
		}
		const nextUpFrom = Math.min(
			creditsStart ?? Infinity,
			runTimeRef.current > 0 ? runTimeRef.current - NEAR_END_TICKS : Infinity
		);
		if (ticks < nextUpFrom) hasTriggeredNextEpisodeRef.current = false;

		// Set while a skip button is on screen, so the next episode card can hold back.
		let skipPromptVisible = false;

		if (mediaSegments) {
			// End credits are worth skipping on a normal episode too, so the outro
			// keeps its own prompt unless the viewer asked for the next episode card
			// in its place, and even then only when that card would really appear.
			const nextUpWouldShow = Boolean(nextEpisode) && !currentIsPreroll &&
				settings.nextUpBehavior !== 'disabled';
			const outroBecomesNextUp = settings.replaceSkipOutroWithNextUp === true && nextUpWouldShow;

			const active = (mediaSegments.list || []).find((seg) => {
				if (seg.end == null || ticks < seg.start || ticks >= seg.end) return false;
				if (seg.type === 'intro') return introAction !== 'none';
				if (seg.type === 'outro') return outroAction !== 'none' && !outroBecomesNextUp;
				return true;
			});

			if (active && !dismissedSegmentsRef.current.has(active.start)) {
				const autoSkip = (active.type === 'intro' && introAction === 'auto') ||
					(active.type === 'outro' && outroAction === 'auto');
				if (autoSkip) {
					handleSkipSegment(active);
				} else {
					// The prompt stops covering the picture after a while when asked to,
					// and seeking back before the segment offers it again.
					const autoHideSeconds = settings.mediaSegmentAutoHide === 's5' ? 5
						: settings.mediaSegmentAutoHide === 's10' ? 10 : 0;
					if (promptShownAtRef.current?.start !== active.start) {
						promptShownAtRef.current = {start: active.start, at: Date.now()};
					}
					if (autoHideSeconds > 0 && Date.now() - promptShownAtRef.current.at > autoHideSeconds * 1000) {
						dismissedSegmentsRef.current.add(active.start);
						setSkipSegment((prev) => (prev ? null : prev));
					} else {
						skipPromptVisible = true;
						const total = Math.max(1, (active.end - active.start) / 10000000);
						const remaining = Math.max(0, Math.round((active.end - ticks) / 10000000));
						setSkipSegment((prev) => (
							prev && prev.type === active.type && prev.remainingSeconds === remaining
								? prev
								: {type: active.type, start: active.start, end: active.end, remainingSeconds: remaining, progress: remaining / total}
						));
					}
				}
			} else if (!active) {
				setSkipSegment((prev) => (prev ? null : prev));
			}

			if (creditsStart != null && outroBecomesNextUp && !hasTriggeredNextEpisodeRef.current && outroAction !== 'none') {
				const inCredits = ticks >= creditsStart;
				if (inCredits) {
					setShowSkipCredits(prev => {
						if (!prev) {
							if (outroAction === 'auto') {
								setTimeout(() => handlePlayNextEpisode(), 0);
								return false;
							}
							return true;
						}
						return prev;
					});
				}
			}
		}

		// The next episode card takes the remote the moment it appears and keeps 5-way
		// movement to itself, so raising it over a skip button leaves that button
		// unpressable. An outro nearly always falls inside this window, so wait until
		// the segment is behind us or the viewer has dismissed it. An outro that runs
		// to the very end still moves on, because the ended handler plays the next one.
		if (nextEpisode && !currentIsPreroll && !skipPromptVisible && runTimeRef.current > 0 && settings.nextUpBehavior !== 'disabled') {
			const remaining = runTimeRef.current - ticks;
			const nearEnd = remaining < NEAR_END_TICKS;
			if (nearEnd && !hasTriggeredNextEpisodeRef.current) {
				setShowNextEpisode(true);
			}
		}
	}, [mediaSegments, settings.introAction, settings.nextUpBehavior, settings.outroAction, settings.replaceSkipOutroWithNextUp, settings.mediaSegmentAutoHide, nextEpisode, currentIsPreroll, runTimeRef, handlePlayNextEpisode, handleSkipSegment]);

	// --- Clearing the way for a popup ---

	// Keyed on which segment it is, not the object, because that carries a countdown that ticks every second.
	// The skip prompt shows over the controls and moves up out of their way, so it clears nothing.
	const skipSegmentStart = skipSegment?.start ?? null;

	useEffect(() => {
		if (!(showSkipCredits || showNextEpisode) || !nextEpisode || activeModal) return;
		hideControls();
		if (settings.autoPlay) startNextEpisodeCountdown();
	}, [showSkipCredits, showNextEpisode, nextEpisode, activeModal, settings.autoPlay, startNextEpisodeCountdown, hideControls]);

	// --- Keydown handler (returns true if event was consumed) ---

	const handlePopupKeyDown = useCallback((e) => {
		const key = e.key || e.keyCode;
		const back = isBackKey(e) || key === 'GoBack';

		// The dialog owns every key while it is up. Enter presses the focused
		// button and the arrows move between them, both through Spotlight, so
		// the player only has to stay out of the way.
		if (askStillWatching) {
			if (back) {
				e.preventDefault();
				e.stopPropagation();
				handleStillWatchingContinue();
			}
			return true;
		}

		const skipPromptUp = skipSegmentStart != null && !activeModal;
		const nextEpisodeVisible = (showSkipCredits || showNextEpisode) && nextEpisode && !activeModal && !controlsVisible;
		const isEnter = key === 'Enter' || e.keyCode === 13;
		const isUp = key === 'ArrowUp' || e.keyCode === 38;
		const isDown = key === 'ArrowDown' || e.keyCode === 40;
		const isSide = key === 'ArrowLeft' || e.keyCode === 37 || key === 'ArrowRight' || e.keyCode === 39;

		if (skipPromptUp) {
			const consume = () => {
				e.preventDefault();
				e.stopPropagation();
			};
			if (!controlsVisible) {
				// The prompt holds focus while the controls are away. Back sends it away for good and OK takes it, and
				// any other key is the viewer reaching for the controls, which come up with the prompt still showing.
				if (back) {
					consume();
					dismissedSegmentsRef.current.add(skipSegmentStart);
					setSkipSegment(null);
					return true;
				}
				if (isEnter) {
					consume();
					handleSkipSegment();
					return true;
				}
				return false;
			}
			// With the controls up, Back closes them and leaves the prompt, which is the player's own handling. Up from
			// the playback bar reaches the prompt, and it stays put under the arrows until Down goes back to the bar.
			if (onSkipPrompt()) {
				if (isDown) {
					consume();
					onLeavePromptDown?.();
					return true;
				}
				if (isUp || isSide) {
					consume();
					showControls();
					return true;
				}
				return false;
			}
			if (isUp && focusRow === 'progress' && Spotlight.focus(SKIP_PROMPT_ID)) {
				consume();
				showControls();
				return true;
			}
			return false;
		}

		if (!nextEpisodeVisible) return false;

		// Next episode / skip credits popup
		if (back) {
			e.preventDefault();
			e.stopPropagation();
			cancelNextEpisodeCountdown();
			return true;
		}
		if (isEnter) return false;
		// Allow Left/Right for navigation
		if (isSide) return false;
		e.preventDefault();
		e.stopPropagation();
		return true;
	}, [askStillWatching, handleStillWatchingContinue, handleSkipSegment, focusRow, onLeavePromptDown, skipSegmentStart, showSkipCredits, showNextEpisode, nextEpisode, activeModal, controlsVisible, showControls, cancelNextEpisodeCountdown]);

	return {
		askStillWatching,
		handleStillWatchingContinue,
		handleStillWatchingStop,
		skipSegment,
		showSkipCredits,
		showNextEpisode,
		nextEpisodeCountdown,
		handleSkipSegment,
		handlePlayNextNow,
		cancelNextEpisodeCountdown,
		checkSegments,
		handlePopupKeyDown,
		resetPopups,
		noteViewerActivity
	};
};

export default useSegmentPopups;
