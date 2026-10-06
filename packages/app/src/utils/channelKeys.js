import {getPlatform} from '../platform';

// The remote's channel keys. Tizen sends them as ChannelUp and ChannelDown. webOS does not hand
// them to apps, and its page up and page down are not channel keys, so a platform with no channel
// keys never matches by code.
const CHANNEL_CODES = {
	tizen: {up: 427, down: 428}
};

// 1 for channel up, -1 for channel down, 0 for any other key.
export const channelKeyStep = (e) => {
	const codes = CHANNEL_CODES[getPlatform()] || {};
	const code = e.keyCode || e.which;
	if (e.key === 'ChannelUp' || code === codes.up) return 1;
	if (e.key === 'ChannelDown' || code === codes.down) return -1;
	return 0;
};
