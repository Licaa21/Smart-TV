// Servers can hand back more than one segment of a kind for the same stretch of an episode: the
// Intro Skipper plugin and the server's own chapter based provider each find an intro, and each
// gets it a little different. Offered as they come, the first prompt skips to where its segment
// ends, which is inside the other, and a second prompt appears straight after.
//
// Segments of one type that overlap are joined into one that ends where the last of them ends, so a
// single press skips the whole thing. It starts where the latest of them starts, since a prompt that
// shows before the intro has begun reads as a mistake. Segments that do not overlap are left alone,
// because a show can have two intros.
export const mergeOverlappingSegments = (list = []) => {
	const sorted = [...list]
		.filter((segment) => segment && segment.start != null)
		.sort((a, b) => a.start - b.start);

	const merged = [];
	for (const segment of sorted) {
		const open = merged.find((kept) =>
			kept.type === segment.type && kept.end != null && segment.end != null &&
			segment.start < kept.end && kept.start < segment.end
		);
		if (!open) {
			merged.push({...segment});
			continue;
		}
		open.start = Math.max(open.start, segment.start);
		open.end = Math.max(open.end, segment.end);
	}
	return merged.sort((a, b) => a.start - b.start);
};

// What a log line says about the list, in whole seconds so a report is readable.
export const describeSegments = (list = []) => list.map((segment) => {
	const seconds = (ticks) => (ticks == null ? null : Math.round(ticks / 10000000));
	return `${segment.type} ${seconds(segment.start)}-${seconds(segment.end)}`;
});
