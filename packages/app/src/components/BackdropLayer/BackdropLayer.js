import {useCallback, useEffect, useRef, memo} from 'react';
import {getPerfTier} from '../../utils/perfTier';
import {serverBlurredUrl} from '../../utils/serverBlur';
import {canSoften, softBackdropUrl} from '../../utils/softBackdrop';

import css from './BackdropLayer.module.less';

const BACKDROP_DEBOUNCE_MS = 500;

const TIER_BLUR_CAPS = {low: 0, mid: 8, high: 20};

const clampBlur = (amount) => {
	const cap = TIER_BLUR_CAPS[getPerfTier()];
	return Math.min(amount || 0, cap);
};

const SHARP_LOOK = {WebkitFilter: 'none', filter: 'none', top: 0, left: 0, width: '100%', height: '100%'};
// The oversize of a layer that is blurred by a filter or by the server, which hides the edges it darkens
const OVERSIZE_LOOK = {top: '', left: '', width: '', height: ''};

const BackdropLayer = memo(({targetUrl: requestedUrl, blurAmount, overlayOpacity, scrimWhenEmpty = true}) => {
	const blurredUrl = serverBlurredUrl(requestedUrl, blurAmount);
	const targetUrl = blurredUrl || requestedUrl;
	// A picture the server cannot blur is made soft by the screen, at any performance level
	const soften = !blurredUrl && blurAmount > 0 && canSoften();
	const layerLook = useCallback((how) => {
		const amount = how === 'soft' || (how === 'plain' && blurredUrl) ? 0 : clampBlur(blurAmount);
		const keepsOversize = how !== 'soft' && (blurredUrl || amount > 0);
		const blurFilter = amount > 0 ? `blur(${amount}px)` : 'none';
		return keepsOversize ? {WebkitFilter: blurFilter, filter: blurFilter, ...OVERSIZE_LOOK} : SHARP_LOOK;
	}, [blurAmount, blurredUrl]);
	const layerARef = useRef(null);
	const layerBRef = useRef(null);
	const activeLayerRef = useRef('a');
	const currentUrlRef = useRef('');
	const timeoutRef = useRef(null);
	// What the screen wants now. A picture still loading for an earlier card is not drawn once focus has moved on.
	const wantedUrlRef = useRef('');

	useEffect(() => {
		return () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		};
	}, []);

	// What is drawn, and how: a changed blur amount draws the same picture again
	const drawKey = targetUrl ? `${targetUrl}|${soften ? 'soft' : 'plain'}|${blurAmount}` : '';

	useEffect(() => {
		wantedUrlRef.current = drawKey;
		if (!targetUrl) {
			if (currentUrlRef.current) {
				currentUrlRef.current = '';
				if (layerARef.current) layerARef.current.style.opacity = '0';
				if (layerBRef.current) layerBRef.current.style.opacity = '0';
			}
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
			return;
		}

		if (drawKey === currentUrlRef.current) return;

		if (timeoutRef.current) clearTimeout(timeoutRef.current);

		timeoutRef.current = setTimeout(() => {
			// How the layer is drawn, by how the picture was made soft: by the server already ('plain'), by the screen
			// scaling a small copy up ('soft'), or, where neither can be, by a CSS filter that the performance level holds
			// back ('css')
			const show = (drawUrl, how) => {
				const img = new window.Image();
				const apply = () => {
					if (wantedUrlRef.current !== drawKey) return;
					const isA = activeLayerRef.current === 'a';
					const incoming = isA ? layerBRef.current : layerARef.current;
					const outgoing = isA ? layerARef.current : layerBRef.current;
					if (!incoming || !outgoing) return;

					incoming.style.transition = 'none';
					incoming.style.opacity = '0';
					incoming.style.backgroundImage = `url(${drawUrl})`;
					Object.assign(incoming.style, layerLook(how));

					incoming.offsetHeight; // eslint-disable-line @babel/no-unused-expressions
					incoming.style.transition = '';
					incoming.style.opacity = '1';
					outgoing.style.opacity = '0';

					activeLayerRef.current = isA ? 'b' : 'a';
					currentUrlRef.current = drawKey;
				};
				img.onload = apply;
				img.onerror = apply;
				img.src = drawUrl;
			};
			if (soften) {
				softBackdropUrl(targetUrl, blurAmount).then((softUrl) => {
					if (wantedUrlRef.current !== drawKey) return;
					show(softUrl || targetUrl, softUrl ? 'soft' : 'css');
				});
			} else {
				show(targetUrl, 'plain');
			}
		}, BACKDROP_DEBOUNCE_MS);
	}, [targetUrl, drawKey, soften, blurAmount, layerLook]);

	// The layers start with the look of the first picture. Each picture then sets its own as it is drawn, so a layer on
	// screen is not restyled before the next one comes.
	const firstLook = useRef(null);
	if (firstLook.current === null) firstLook.current = layerLook(soften ? 'soft' : 'plain');
	const layerStyle = firstLook.current;

	// How much picture shows through is the screen's own call, since a page laying
	// a grid over the whole thing needs more of it covered than one that only
	// wants the colour.
	const overlayStyle = typeof overlayOpacity === 'number' ? {opacity: overlayOpacity} : undefined;

	return (
		<div className={css.globalBackdrop}>
			<div
				ref={layerARef}
				className={css.globalBackdropImage}
				style={layerStyle}
			/>
			<div
				ref={layerBRef}
				className={css.globalBackdropImage}
				style={layerStyle}
			/>
			{(scrimWhenEmpty || targetUrl) && <div className={css.globalBackdropOverlay} style={overlayStyle} />}
		</div>
	);
});

export default BackdropLayer;
