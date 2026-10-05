// The page side of the link to the UWP host that shows the app in WebView2 on
// Xbox.
//
// The host writes what it knows about the console into window.__MOONFIN_XBOX__
// before any page code runs, and later messages arrive as moonfin:xbox events on
// window. Messages to the host go through the one string argument of
// window.chrome.webview.postMessage. Both directions carry a version so either
// side can refuse what it doesnt understand.

const BRIDGE_VERSION = 1;
const PAGE_EVENT = 'moonfin:xbox';

export const bootData = () => {
	const data = typeof window !== 'undefined' ? window.__MOONFIN_XBOX__ : null;
	return data && data.v === BRIDGE_VERSION ? data : null;
};

export const postToShell = (type, payload) => {
	const host = typeof window !== 'undefined' && window.chrome && window.chrome.webview;
	if (!host) return false;
	host.postMessage(JSON.stringify({v: BRIDGE_VERSION, type, payload}));
	return true;
};

// Calls back with the payload of every message of the given type, and returns
// the remover.
export const onShellMessage = (type, handler) => {
	if (typeof window === 'undefined') return () => {};
	const listener = (event) => {
		const message = event.detail;
		if (message && message.v === BRIDGE_VERSION && message.type === type) handler(message.payload);
	};
	window.addEventListener(PAGE_EVENT, listener);
	return () => window.removeEventListener(PAGE_EVENT, listener);
};

// window.close does nothing in the WebView, so the host is asked instead.
export const exitApp = () => postToShell('EXIT_APP');

// The WebView refuses a certificate it cant verify, and only the host can tell
// it to go ahead for a server.
export const allowInsecureHost = (host) => postToShell('ALLOW_INSECURE_HOST', {host});
