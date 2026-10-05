import {getPlatform} from '../platform';

// The remote's channel keys. Tizen sends them as ChannelUp and ChannelDown, and webOS as page up
// and page down. A platform with no channel keys never matches by code.
const CHANNEL_CODES = {
	tizen: {up: 427, down: 428},
	webos: {up: 33, down: 34}
};

// 1 for channel up, -1 for channel down, 0 for any other key.
export const channelKeyStep = (e) => {
	const codes = CHANNEL_CODES[getPlatform()] || {};
	const code = e.keyCode || e.which;
	if (e.key === 'ChannelUp' || code === codes.up) return 1;
	if (e.key === 'ChannelDown' || code === codes.down) return -1;
	return 0;
};
