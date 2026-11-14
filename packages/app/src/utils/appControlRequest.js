// A Smart Hub tile (or another app) opens a title by sending Moonfin an app control with a PAYLOAD. A cold start reads
// it once, and a running app is told by the `appcontrol` event. On the Q67A (Tizen 6.0) a running Moonfin only came to
// the front, so the request is also looked for when the page is shown again or gets focus, where
// getRequestedAppControl() holds the newest request.

const SAME_REQUEST_MS = 2000;

// What the request asks for, or null when there is none or it is not a title.
export const readRequestedDeepLink = (tizenApi = typeof window !== 'undefined' ? window.tizen : undefined) => {
	try {
		const requested = tizenApi?.application?.getCurrentApplication?.().getRequestedAppControl?.();
		const data = requested?.appControl?.data;
		if (!data) return null;
		for (let i = 0; i < data.length; i++) {
			if (data[i].key !== 'PAYLOAD') continue;
			const values = JSON.parse(JSON.parse(data[i].value?.[0]).values);
			if (!values?.id) return null;
			const detail = {id: values.id, type: values.type, serverId: values.serverid, seasonId: values.seasonid, seriesId: values.seriesid};
			// A sender that stamps each press (the Couch TV app sends the time as `n`) makes a repeat of the same title a request of
			// its own: the platform keeps answering with the last request, so only a stamp tells that repeat from the stale one.
			if (values.n !== undefined && values.n !== null) detail.n = String(values.n);
			return {detail};
		}
	} catch (e) {
		return null;
	}
	return null;
};

const keyOf = (detail) => `${detail.id}|${detail.type}|${detail.serverId}|${detail.n === undefined ? '' : detail.n}`;

// Says whether a request is one to act on. The same request twice within a moment is one request (the event and the page
// coming back both report it), and with `onlyNew` a request that is the one acted on last is left alone, since the
// platform keeps answering with the request the app started with after it was dealt with. A request that carries a stamp
// (`n`) is told from the last one by it, so the same title pressed again is new whichever way it arrives.
export const makeDeepLinkGate = () => {
	let last = {key: null, at: 0};
	// The newest stamp seen: a look that finds an older one has found the stale request the platform keeps answering with
	let newest = -Infinity;
	const stamped = (detail) => (detail.n !== undefined && Number.isFinite(Number(detail.n)) ? Number(detail.n) : null);
	const note = (detail) => {
		const stamp = stamped(detail);
		if (stamp !== null && stamp > newest) newest = stamp;
	};
	const gate = (detail, {onlyNew = false, now = Date.now()} = {}) => {
		if (!detail?.id) return false;
		const key = keyOf(detail);
		if (key === last.key && (onlyNew || now - last.at < SAME_REQUEST_MS)) return false;
		if (onlyNew && stamped(detail) !== null && stamped(detail) < newest) return false;
		last = {key, at: now};
		note(detail);
		return true;
	};
	// A request already known to be dealt with, such as the one the app started with. It only stops a later look from
	// taking it for a new one, and a fresh report of it from the platform still counts.
	gate.markHandled = (detail) => {
		if (detail?.id) {
			last = {key: keyOf(detail), at: 0};
			note(detail);
		}
	};
	return gate;
};
