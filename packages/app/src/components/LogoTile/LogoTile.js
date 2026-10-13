import {memo, useEffect, useState} from 'react';
import Spottable from '@enact/spotlight/Spottable';

import {logoNeedsWhite} from '../../utils/logoTone';

import css from './LogoTile.module.less';

const SpottableDiv = Spottable('div');

const PROBE_SIZE = 24;

// Looked up once per logo. A picture the TV will not let be read is drawn white, since most logos are dark.
const toneCache = {};
const measure = (url, done) => {
	if (url in toneCache) {
		done(toneCache[url]);
		return;
	}
	const probe = new window.Image();
	probe.crossOrigin = 'anonymous';
	probe.onload = () => {
		let white = false;
		try {
			const canvas = document.createElement('canvas');
			canvas.width = PROBE_SIZE;
			canvas.height = PROBE_SIZE;
			const context = canvas.getContext('2d');
			context.drawImage(probe, 0, 0, PROBE_SIZE, PROBE_SIZE);
			white = logoNeedsWhite(context.getImageData(0, 0, PROBE_SIZE, PROBE_SIZE).data);
		} catch (e) {
			// Not readable, and most logos are dark, so it is drawn white
			white = true;
		}
		toneCache[url] = white;
		done(white);
	};
	probe.onerror = () => {
		toneCache[url] = true;
		done(true);
	};
	probe.src = url;
};

/**
 * A studio or network logo on a grey tile, the same on Home and on the Seerr screen. The logo keeps its own colors when
 * they stand out from the tile, or is already white, and a dark one is drawn white, so every one is readable without focus.
 * @param {Object} props
 * @param {string} props.url - the logo
 * @param {string} props.name - what the logo says
 */
const LogoTile = ({url, name, className, ...rest}) => {
	const [white, setWhite] = useState(() => toneCache[url] === true);
	useEffect(() => {
		let live = true;
		if (url) measure(url, (value) => live && setWhite(value));
		return () => {
			live = false;
		};
	}, [url]);

	return (
		<SpottableDiv {...rest} className={`${css.logoTile} ${white ? css.white : ''}${className ? ` ${className}` : ''}`}>
			{url && <img className={css.logoImage} src={url} alt={name} loading="lazy" />}
		</SpottableDiv>
	);
};

export default memo(LogoTile);
