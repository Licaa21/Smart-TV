import {useCallback, useRef} from 'react';
import * as playback from '../../services/playback';
import {chapterStep} from '../../utils/chapterMarkers';
import {isPreroll, nextInQueue} from '../../utils/cinemaMode';

// A jump takes a moment to land, and until it does the position still reads where it was, so a
// quick second press steps on from where the first one went.
const LANDING_MS = 5000;
const LANDED_TICKS = 20000000;

// Channel up and down step through chapters and then on to the next or previous episode, and
// change channels on live TV.
const useChannelKeys = ({
	item, videoQueueRef, chapters, positionRef, isLiveTV, isAudioMode,
	stepChannel, showControls, seekToChapter, noteViewerActivity,
	onPlayItem, onPlayNextNow, onNextTrack, onPrevTrack
}) => {
	const jumpRef = useRef(null);

	// Down past the first chapter plays what came before, the previous entry of a queue or else the
	// episode before this one.
	const playPrevious = useCallback(async () => {
		const queued = nextInQueue(videoQueueRef.current, item, -1);
		const previous = queued && !isPreroll(queued) ? queued : await playback.getNextEpisode(item, -1);
		if (previous) onPlayItem(previous);
	}, [item, videoQueueRef, onPlayItem]);

	return useCallback((step) => {
		if (isLiveTV) {
			stepChannel(step);
			return;
		}
		showControls();
		noteViewerActivity();
		const position = positionRef.current;
		const jump = jumpRef.current;
		const elapsed = jump ? Date.now() - jump.at : Infinity;
		const landed = jump && position >= jump.ticks - LANDED_TICKS && position <= jump.ticks + elapsed * 10000 + LANDED_TICKS;
		const ticks = chapterStep(chapters, elapsed < LANDING_MS && !landed ? jump.ticks : position, step);
		if (ticks != null) {
			jumpRef.current = {ticks, at: Date.now()};
			seekToChapter(ticks);
		} else if (isAudioMode) {
			(step > 0 ? onNextTrack : onPrevTrack)();
		} else if (step > 0) {
			onPlayNextNow();
		} else {
			playPrevious();
		}
	}, [isLiveTV, isAudioMode, chapters, positionRef, stepChannel, showControls, noteViewerActivity, seekToChapter, onNextTrack, onPrevTrack, onPlayNextNow, playPrevious]);
};

export default useChannelKeys;
