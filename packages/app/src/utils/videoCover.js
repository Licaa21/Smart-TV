// TVs draw video on a plane sized to the element's box and ignore object-fit and
// transforms on it, so a video is fitted by sizing the element itself from its own
// dimensions. It fills the box and leaves the overhang for the box to clip, and
// returns false when there's nothing to size yet.
export const coverVideoInBox = (video, box, zoom = 1) => {
	if (!video || !box || !video.videoWidth || !video.videoHeight) return false;
	const boxWidth = box.clientWidth;
	const boxHeight = box.clientHeight;
	if (!boxWidth || !boxHeight) return false;
	const scale = Math.max(boxWidth / video.videoWidth, boxHeight / video.videoHeight) * zoom;
	const width = Math.round(video.videoWidth * scale);
	const height = Math.round(video.videoHeight * scale);
	video.style.width = `${width}px`;
	video.style.height = `${height}px`;
	video.style.left = `${Math.round((boxWidth - width) / 2)}px`;
	video.style.top = `${Math.round((boxHeight - height) / 2)}px`;
	return true;
};

// Puts the shared element back to filling whatever holds it next.
export const resetVideoBox = (video) => {
	if (!video) return;
	video.style.width = '100%';
	video.style.height = '100%';
	video.style.left = '0';
	video.style.top = '0';
};
