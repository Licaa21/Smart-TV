import * as playback from '../services/playback';
import {runPlayerCommand} from '../services/remoteControl';

export const stopPlaybackForTrailer = async (excludedVideo = null) => {
	// Music left playing behind the screens stops the way its Stop button would, pill and all.
	await runPlayerCommand('stop');
	const session = playback.getCurrentSession();
	const videoElements = Array.from(document.querySelectorAll('video'));
	const activeVideo = videoElements.find((video) => !video.paused && Number.isFinite(video.currentTime) && video.currentTime > 0);
	const positionTicks = activeVideo ? Math.floor(activeVideo.currentTime * 10000000) : 0;

	if (session) {
		try {
			await playback.reportStop(positionTicks);
		} catch (err) { void err; }
	}

	videoElements.forEach((video) => {
		if (video !== excludedVideo && !video.paused) {
			try {
				video.pause();
			} catch (err) { void err; }
		}
	});
};
