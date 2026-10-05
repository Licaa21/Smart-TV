import {getPlatform} from '../platform';

// Loads the platform's version of a module. Webpack splits each import it can see
// into its own chunk, so every platform is spelled out rather than built from a
// name, and anything it doesnt know is given the webOS one, which runs on a plain
// browser.
const LOADERS = {
	storage: {
		tizen: () => import('@moonfin/platform-tizen/storage'),
		webos: () => import('@moonfin/platform-webos/storage'),
		vega: () => import('@moonfin/platform-vega/storage')
	},
	video: {
		tizen: () => import('@moonfin/platform-tizen/video'),
		webos: () => import('@moonfin/platform-webos/video'),
		vega: () => import('@moonfin/platform-vega/video')
	},
	deviceProfile: {
		tizen: () => import('@moonfin/platform-tizen/deviceProfile'),
		webos: () => import('@moonfin/platform-webos/deviceProfile'),
		vega: () => import('@moonfin/platform-vega/deviceProfile')
	},
	deviceInfo: {
		tizen: () => import('@moonfin/platform-tizen/deviceInfo'),
		webos: () => import('@moonfin/platform-webos/deviceInfo'),
		vega: () => import('@moonfin/platform-vega/deviceInfo')
	},
	volume: {
		tizen: () => import('@moonfin/platform-tizen/volume'),
		webos: () => import('@moonfin/platform-webos/volume'),
		vega: () => import('@moonfin/platform-vega/volume')
	},
	countryCode: {
		tizen: () => import('@moonfin/platform-tizen/countryCode'),
		webos: () => import('@moonfin/platform-webos/countryCode'),
		vega: () => import('@moonfin/platform-vega/countryCode')
	}
};

export const resolvePlatformModule = (name) => {
	const loaders = LOADERS[name];
	if (!loaders) return Promise.reject(new Error(`No platform module named ${name}`));
	return (loaders[getPlatform()] || loaders.webos)();
};
