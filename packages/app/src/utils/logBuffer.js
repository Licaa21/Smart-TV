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

// The report is held in memory, so it is lost when the app is closed and started again, which is
// exactly when a standby or relaunch problem needs to be explained. The lines that are not
// requests are kept in storage as well and come back, marked, at the next start.
export const PERSIST_KEY = 'moonfin_diag_ring';
export const PERSIST_MAX = 200;

export const persistableLines = (buffer, max, isRequestLine) => buffer
	.filter((entry) => !isRequestLine(entry))
	.slice(-max)
	.map(({timestamp, level, category, message, context}) => ({timestamp, level, category, message, context}));

export const restoreLines = (raw) => {
	try {
		const list = JSON.parse(raw);
		if (!Array.isArray(list)) return [];
		return list
			.filter((entry) => entry && entry.timestamp && entry.message)
			.map((entry) => ({...entry, context: {...(entry.context || {}), previousRun: true}}));
	} catch {
		return [];
	}
};
