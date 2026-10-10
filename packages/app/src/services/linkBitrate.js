// How much this device can pull from a server each second, by the server's own
// bitrate test.
//
// A wireless link can carry far less than the device plays, and a stream asked for
// at more than the link carries stalls from start to finish. Where a platform asks
// for it, the automatic bitrate is held under what was measured here.
import {legacyAuthHeader} from '../utils/serverRoutes';

const TEST_BYTES = 1000000;
const LONGER_TEST_BYTES = 4000000;
// A test over sooner than this was too short to time well, and a longer one follows
const SHORT_TEST_MS = 500;
const TEST_TIMEOUT_MS = 6000;
const RAMP_SHARE = 0.3;
const KEPT_FOR_MS = 10 * 60 * 1000;
// The link also carries the rest of the app and whatever else is on the network
const HEADROOM = 0.7;
const LOWEST_BITRATE = 1500000;

const kept = new Map();
const underway = new Map();

// Timed from the first data in, so the wait for the server to answer isnt counted.
// A test cut off by the timeout still says how fast the link was until then.
const timeDownload = async (serverUrl, headers, bytes) => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
	let started = 0;
	let received = 0;
	let settled = null;
	try {
		const response = await fetch(`${serverUrl}/Playback/BitrateTest?Size=${bytes}`, {headers, cache: 'no-store', signal: controller.signal});
		if (!response.ok || !response.body) return null;
		const reader = response.body.getReader();
		for (;;) {
			const {done, value} = await reader.read();
			if (done) break;
			if (started) received += value.byteLength;
			else started = performance.now();
			if (!settled && received >= bytes * RAMP_SHARE) settled = {at: performance.now(), received};
		}
	} catch (err) {
		if (err.name !== 'AbortError') return null;
	} finally {
		clearTimeout(timer);
	}
	const now = performance.now();
	const ms = started ? now - started : 0;
	if (ms <= 0 || received < bytes / 20) return null;
	// A connection takes a moment to reach its speed, so the rate is read off what came
	// after that, where enough did
	const steady = settled && received - settled.received >= bytes * RAMP_SHARE && now > settled.at;
	const bitsPerSecond = steady ? ((received - settled.received) * 8000) / (now - settled.at) : (received * 8000) / ms;
	return {ms, bitsPerSecond};
};

const measure = async ({serverUrl, serverType, authHeader}) => {
	const headers = {Authorization: authHeader, ...legacyAuthHeader(serverType, authHeader)};
	let result = await timeDownload(serverUrl, headers, TEST_BYTES);
	if (result && result.ms < SHORT_TEST_MS) result = (await timeDownload(serverUrl, headers, LONGER_TEST_BYTES)) || result;
	return result ? Math.max(LOWEST_BITRATE, Math.round(result.bitsPerSecond * HEADROOM)) : null;
};

// The bitrate to stay under for a server, or null when it couldnt be measured. A
// test run while something plays would be sharing the link with it, so then the
// last answer is all that is given, however old.
export const linkBitrate = (server, canMeasure = true) => {
	const serverUrl = String(server.serverUrl || '').replace(/\/+$/, '');
	if (!serverUrl) return Promise.resolve(null);
	const last = kept.get(serverUrl);
	if (last && (!canMeasure || Date.now() - last.at < KEPT_FOR_MS)) return Promise.resolve(last.bitrate);
	if (!canMeasure) return Promise.resolve(null);
	if (!underway.has(serverUrl)) {
		underway.set(serverUrl, measure({...server, serverUrl}).then((bitrate) => {
			underway.delete(serverUrl);
			if (bitrate) kept.set(serverUrl, {bitrate, at: Date.now()});
			return bitrate;
		}));
	}
	return underway.get(serverUrl);
};
