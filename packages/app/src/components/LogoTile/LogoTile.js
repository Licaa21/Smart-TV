import {memo, useEffect, useState} from 'react';
import Spottable from '@enact/spotlight/Spottable';

import {toneOfPixels} from '../../utils/logoTone';

import css from './LogoTile.module.less';

const SpottableDiv = Spottable('div');

const PROBE_SIZE = 24;

// Looked up once per logo. A picture the TV will not let be read counts as not pale, which is the light tile.
const toneCache = {};
const measure = (url, done) => {
	if (url in toneCache) {
		done(toneCache[url]);
		return;
	}
	const probe = new window.Image();
	probe.crossOrigin = 'anonymous';
	probe.onload = () => {
		let pale = false;
		try {
			const canvas = document.createElement('canvas');
			canvas.width = PROBE_SIZE;
			canvas.height = PROBE_SIZE;
			const context = canvas.getContext('2d');
			context.drawImage(probe, 0, 0, PROBE_SIZE, PROBE_SIZE);
			pale = toneOfPixels(context.getImageData(0, 0, PROBE_SIZE, PROBE_SIZE).data);
		} catch (e) {
			pale = false;
		}
		toneCache[url] = pale;
		done(pale);
	};
	probe.onerror = () => {
		toneCache[url] = false;
	};
	probe.src = url;
};

/**
 * A studio or network logo on a tile, the same on Home and on the Seerr screen. The logo keeps its own colors and
 * is readable without focus: on a light tile, or on a dark one when the logo is white.
 * @param {Object} props
 * @param {string} props.url - the logo
 * @param {string} props.name - what the logo says
 */
const LogoTile = ({url, name, className, ...rest}) => {
	const [pale, setPale] = useState(() => toneCache[url] === true);
	useEffect(() => {
		let live = true;
		if (url) measure(url, (value) => live && setPale(value));
		return () => {
			live = false;
		};
	}, [url]);

	return (
		<SpottableDiv {...rest} className={`${css.logoTile} ${pale ? css.pale : ''}${className ? ` ${className}` : ''}`}>
			{url && <img className={css.logoImage} src={url} alt={name} loading="lazy" />}
		</SpottableDiv>
	);
};

export default memo(LogoTile);
