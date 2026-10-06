// The report keeps the last few hundred lines, and every request the app makes is one of them, so a
// busy screen pushes out the playback and standby lines that explain a problem. When the buffer is
// full the oldest request line goes first, and only when there are none does the oldest of the rest.
export const trimLogBuffer = (buffer, max, isRequestLine) => {
	while (buffer.length > max) {
		const at = buffer.findIndex(isRequestLine);
		buffer.splice(at >= 0 ? at : 0, 1);
	}
	return buffer;
};
