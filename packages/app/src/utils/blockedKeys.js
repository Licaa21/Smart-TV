/* global tizen */
import {getPlatform} from '../platform';

// Remote buttons that hand the TV over to its tuner or to another app. A registered key goes to
// Moonfin and not to the system, and nothing here is bound to these, so pressing one leaves the app
// where it is. Besides the channel and guide keys, any key the TV lists by the name of a streaming
// service is taken too. The dedicated app buttons on some remotes are not listed, and the firmware
// keeps those for itself.
export const BLOCKED_KEY_NAMES = ['ChannelUp', 'ChannelDown', 'ChannelList', 'PreviousChannel', 'Guide'];
export const BLOCKED_KEY_PATTERN = /netflix|rakuten|prime|amazon|disney|hulu|hbo|youtube|apple|tvplus|shortcut/i;

export const registerBlockedKeys = () => {
	if (getPlatform() !== 'tizen') return;
	if (typeof tizen === 'undefined' || !tizen.tvinputdevice) return;

	try {
		const supportedKeyNames = tizen.tvinputdevice.getSupportedKeys().map((k) => k.name);
		console.log('[keys] keys this TV offers:', supportedKeyNames.join(', '));
		const wanted = supportedKeyNames.filter((name) => BLOCKED_KEY_NAMES.includes(name) || BLOCKED_KEY_PATTERN.test(name));
		wanted.forEach((keyName) => {
			try {
				tizen.tvinputdevice.registerKey(keyName);
			} catch (e) {
				console.warn(`Failed to register key ${keyName}:`, e);
			}
		});
	} catch (e) {
		console.error('Error registering blocked TV keys:', e);
	}
};
