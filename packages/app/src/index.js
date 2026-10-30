/* global ENACT_PACK_ISOMORPHIC, Element */

// Boot-critical polyfills — must be the very first import.
import './polyfills';
import 'whatwg-fetch';

import {createRoot, hydrateRoot} from 'react-dom/client';

import App, {localeStringsReady} from './App';
import {isTizen} from './platform';
import {registerKeys, ESSENTIAL_KEY_NAMES, paceArrowKeys, watchArrowHolds} from './utils/keys';
import {registerBlockedKeys} from './utils/blockedKeys';
import serverLogger from './services/serverLogger';
import {scrollAtPointerEdges} from './utils/pointerEdgeScroll';
import {installSlideScroll} from './utils/slideScroll';
import {setArtLogSink} from './components/MediaCard/artPrefetch';

const enforceTizenViewport = () => {
	if (typeof document === 'undefined' || !isTizen()) return;

	let viewportMeta = document.querySelector('meta[name="viewport"]');
	if (!viewportMeta) {
		viewportMeta = document.createElement('meta');
		viewportMeta.setAttribute('name', 'viewport');
		document.head.appendChild(viewportMeta);
	}

	// Prevent browser-level page zoom shifts on some Tizen WebKit builds.
	viewportMeta.setAttribute(
		'content',
		'width=device-width,initial-scale=1,maximum-scale=1,minimum-scale=1,user-scalable=no,viewport-fit=cover'
	);
};

// Polyfill Element.prototype.scrollTo for older webOS/Tizen browsers
if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
	Element.prototype.scrollTo = function (options) {
		if (typeof options === 'object') {
			this.scrollLeft = options.left !== undefined ? options.left : this.scrollLeft;
			this.scrollTop = options.top !== undefined ? options.top : this.scrollTop;
		} else if (arguments.length >= 2) {
			this.scrollLeft = arguments[0];
			this.scrollTop = arguments[1];
		}
	};
}

if (isTizen()) {
	enforceTizenViewport();
	registerKeys(ESSENTIAL_KEY_NAMES);
	registerBlockedKeys();
}

const appElement = (<App />);

if (typeof window !== 'undefined') {
	// The watcher goes first, so the report says what the set sent and not what the pacing let through
	watchArrowHolds(window, (hold) => serverLogger.info('Navigation', 'Arrow held', hold));
	// A card focused before its wide art was there is told to the report, with what became of the art
	setArtLogSink((message, context) => serverLogger.info('Navigation', message, context));
	paceArrowKeys();
	scrollAtPointerEdges();
	// Rows and lists slide to where a key press scrolled them, and do not jump
	installSlideScroll();
	// The locale strings arrive in their own chunk, so hold the first render until
	// they land. Otherwise the app paints English and swaps a frame later.
	localeStringsReady.then(() => {
		if (ENACT_PACK_ISOMORPHIC) {
			hydrateRoot(document.getElementById('root'), appElement);
		} else {
			createRoot(document.getElementById('root')).render(appElement);
		}
	});
}

export default appElement;
