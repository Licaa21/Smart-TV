/* global tizen */
import {isTizen, isVega, isWebOS, isXbox} from '../platform';
import {loadShellBridge} from '../services/shellBridge';

// webOS holds a relaunched app in the background until this is called. Sets on 4.x and
// below carry the object as PalmSystem alone, and 5.0 and above carry it under both names.
export const activateApp = () => {
	if (!isWebOS()) return;
	const host = window.webOSSystem || window.PalmSystem;
	if (!host) return;
	try {
		host.activate();
	} catch (e) {
		// nothing else would bring the app forward
	}
};

export const exitApp = () => {
	if (isTizen() && typeof tizen !== 'undefined') {
		tizen.application.getCurrentApplication().exit();
		return;
	}
	// The WebView has no window of its own to close, so the shell is asked instead.
	if (isVega() || isXbox()) {
		loadShellBridge().then((bridge) => bridge.exitApp());
		return;
	}
	window.close();
};
