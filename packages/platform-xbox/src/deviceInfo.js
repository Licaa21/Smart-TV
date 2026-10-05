import {bootData} from './bridge';

let cached = null;

// The host names the console as Windows does, as in "Xbox One S".
export const modelName = () => bootData()?.device?.form || '';

export const getDeviceInfo = async () => {
	if (cached) return cached;
	const boot = bootData();
	cached = {
		platform: 'Xbox',
		appVersion: process.env.REACT_APP_VERSION || '0.0.0',
		userAgent: navigator.userAgent || 'Unknown',
		screenSize: `${window.screen.width}x${window.screen.height}`,
		tvVersion: boot?.os?.version ? `Xbox OS ${boot.os.version}` : 'Unknown',
		modelName: modelName() || 'Unknown',
		ipAddress: boot?.ip || null
	};
	return cached;
};
