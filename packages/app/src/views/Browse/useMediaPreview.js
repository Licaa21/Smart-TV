import {useEffect, useMemo, useRef, useState} from 'react';
import {getPlatform, isLegacyTizen} from '../../platform';
import {getDeviceCapabilities} from '../../services/deviceProfile';
import {mediaPreviewAllowedOnDevice} from '../../services/mediaPreviewSource';
import {createMediaPreviewController} from './mediaPreviewController';

// Owns the card preview controller for the home rows. It follows the setting and
// the device gate, and stops a running preview whenever the rows leave the screen:
// the media bar taking over, another panel on top, the screensaver, or the app
// going to the background. The controller is what the cards reach through context.
export default function useMediaPreview({api, settings, isVisible, browseMode, onThemeMusicHold}) {
	const settingsRef = useRef(settings);
	settingsRef.current = settings;
	const holdRef = useRef(onThemeMusicHold);
	holdRef.current = onThemeMusicHold;
	const platform = useMemo(() => getPlatform(), []);

	const controller = useMemo(() => createMediaPreviewController({
		getSettings: () => settingsRef.current,
		api,
		onThemeMusicHold: (held) => holdRef.current?.(held),
		platform
	}), [api, platform]);

	useEffect(() => () => controller.dispose(), [controller]);

	const [screensaverActive, setScreensaverActive] = useState(false);
	const [webosVersion, setWebosVersion] = useState(null);

	useEffect(() => {
		if (platform !== 'webos') return undefined;
		let cancelled = false;
		getDeviceCapabilities()
			.then((caps) => {
				if (!cancelled) setWebosVersion(typeof caps?.webosVersion === 'number' ? caps.webosVersion : null);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [platform]);

	useEffect(() => {
		const handleScreensaver = (e) => setScreensaverActive(!!e.detail?.active);
		window.addEventListener('moonfin:screensaver', handleScreensaver);
		return () => window.removeEventListener('moonfin:screensaver', handleScreensaver);
	}, []);

	const deviceAllowed = mediaPreviewAllowedOnDevice({
		platform,
		legacyTizen: isLegacyTizen(),
		webosVersion,
		performanceMode: settings.performanceMode
	});
	const enabled = !!settings.episodePreviewEnabled && deviceAllowed && isVisible && browseMode === 'rows' && !screensaverActive;

	useEffect(() => {
		controller.setEnabled(enabled);
	}, [controller, enabled]);

	// The controller reads the volume from settings, so a new volume re-applies the audio too.
	useEffect(() => {
		controller.setAudioEnabled(settings.previewAudioEnabled !== false);
	}, [controller, settings.previewAudioEnabled, settings.previewVolume]);

	// Older sets only fire the prefixed event, so both are watched.
	useEffect(() => {
		const stopWhenHidden = () => {
			if (document.hidden || document.webkitHidden) controller.stop('hidden');
		};
		document.addEventListener('visibilitychange', stopWhenHidden);
		document.addEventListener('webkitvisibilitychange', stopWhenHidden);
		return () => {
			document.removeEventListener('visibilitychange', stopWhenHidden);
			document.removeEventListener('webkitvisibilitychange', stopWhenHidden);
		};
	}, [controller]);

	return controller;
}
