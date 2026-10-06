/* global ENACT_PACK_ISOMORPHIC, Element */

// Boot-critical polyfills — must be the very first import.
import './polyfills';
import 'whatwg-fetch';

import {createRoot, hydrateRoot} from 'react-dom/client';

import App, {localeStringsReady} from './App';
import {isTizen} from './platform';
import {registerKeys, ESSENTIAL_KEY_NAMES} from './utils/keys';
import {registerBlockedKeys} from './utils/blockedKeys';

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

// Polyfill: Slider knob positioning for browsers without CSS custom properties
// (e.g. Tizen 2.4 / WebKit r152340). No-op on modern browsers.
(function () {
	if (typeof window === 'undefined') return;
	if (window.CSS && window.CSS.supports && window.CSS.supports('--a', '0')) return;

	function patchSliderKnobs () {
		const sliders = document.querySelectorAll('[class*="slider"]');
		for (let i = 0; i < sliders.length; i++) {
			const el = sliders[i];
			const style = el.getAttribute('style');
			if (!style) continue;

			const match = style.match(/--slider-knob-pct:\s*([^;]+)/);
			if (match) {
				const pct = match[1].trim();
				const knob = el.querySelector('[class*="knob"]');
				if (knob) {
					if (el.className.indexOf('vertical') !== -1) {
						knob.style.bottom = pct;
					} else {
						knob.style.left = pct;
					}
				}
			}
		}
	}

	// A slider only moves in answer to the remote or the pointer, so it is patched after those, once
	// per frame, and not every frame for as long as the app is open.
	let rafId;
	function schedulePatch () {
		if (rafId) return;
		rafId = window.requestAnimationFrame(function () {
			rafId = null;
			patchSliderKnobs();
		});
	}

	['keydown', 'keyup', 'click', 'mouseup', 'touchend'].forEach(function (name) {
		document.addEventListener(name, schedulePatch, true);
	});

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', schedulePatch);
	} else {
		schedulePatch();
	}
})();

if (isTizen()) {
	enforceTizenViewport();
	registerKeys(ESSENTIAL_KEY_NAMES);
	registerBlockedKeys();
}

const appElement = (<App />);

if (typeof window !== 'undefined') {
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
