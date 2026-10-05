export const isWebOS = () => {
	if (process.env.REACT_APP_PLATFORM === 'webos') return true;
	if (typeof window === 'undefined') return false;
	return typeof window.PalmServiceBridge !== 'undefined' ||
		navigator.userAgent.includes('Web0S') ||
		navigator.userAgent.includes('webOS');
};

export const isTizen = () => {
	if (process.env.REACT_APP_PLATFORM === 'tizen') return true;
	if (typeof window === 'undefined') return false;
	return typeof window.tizen !== 'undefined' ||
		navigator.userAgent.toLowerCase().includes('tizen');
};

// The React Native shell that hosts the app on Fire TV puts this on the window
// before any page code runs.
export const isVega = () => {
	if (process.env.REACT_APP_PLATFORM === 'vega') return true;
	if (typeof window === 'undefined') return false;
	return typeof window.__MOONFIN_VEGA__ !== 'undefined';
};

export const getPlatform = () => {
	if (process.env.REACT_APP_PLATFORM) return process.env.REACT_APP_PLATFORM;
	if (isWebOS()) return 'webos';
	if (isTizen()) return 'tizen';
	if (isVega()) return 'vega';
	return 'unknown';
};

export const isLegacyTizen = () => {
	if (!isTizen() || typeof navigator === 'undefined') return false;
	const match = (navigator.userAgent || '').match(/Tizen\s([0-9]+(?:\.[0-9]+)?)/i);
	if (!match) return true;
	const version = parseFloat(match[1]);
	return !Number.isFinite(version) || version <= 3.0;
};
