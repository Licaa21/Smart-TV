import {useEffect, useState} from 'react';

import {exifOrientation, needsRedraw, orientationMatrix} from '../../utils/avatarOrientation';

// A profile picture, turned the right way up. Jellyfin 12 sends the file as it was uploaded, flag and all, at any size (one of the
// user's was 5.9 MB for a circle of 64 px), and the Chromium 76 of a 2021 Samsung ignores the flag. So here the picture is
// fetched once, drawn turned and cut to a small square, and that is what the screen shows. Anywhere that turns pictures itself
// (Chromium 81 on) it is shown as it is, and so it is when anything here fails.

const SIZE = 256;
const HEAD_BYTES = 64 * 1024;

const done = new Map();
const pending = new Map();
// A phone photo takes a big decode, so they come one at a time.
let line = Promise.resolve();

const turnsItself = () => Boolean(window.CSS && typeof window.CSS.supports === 'function' && window.CSS.supports('image-orientation', 'from-image'));

const load = (url) => new Promise((resolve, reject) => {
	const img = new window.Image();
	img.onload = () => resolve(img);
	img.onerror = reject;
	img.src = url;
});

const render = async (url) => {
	const response = await fetch(url);
	if (!response.ok) return url;
	const blob = await response.blob();
	const head = new Uint8Array(await new Response(blob.slice(0, HEAD_BYTES)).arrayBuffer());
	const orientation = exifOrientation(head);
	if (!needsRedraw(orientation, blob.type, blob.size)) return url;

	const source = URL.createObjectURL(blob);
	try {
		const img = await load(source);
		const upright = orientationMatrix(orientation, img.naturalWidth, img.naturalHeight);
		const scale = SIZE / Math.min(upright.width, upright.height);
		const canvas = document.createElement('canvas');
		canvas.width = SIZE;
		canvas.height = SIZE;
		const ctx = canvas.getContext('2d');
		ctx.setTransform(scale, 0, 0, scale, (SIZE - upright.width * scale) / 2, (SIZE - upright.height * scale) / 2);
		ctx.transform(...upright.matrix);
		ctx.drawImage(img, 0, 0);
		const small = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
		return small ? URL.createObjectURL(small) : url;
	} finally {
		URL.revokeObjectURL(source);
	}
};

const uprightSrc = (url) => {
	if (done.has(url)) return Promise.resolve(done.get(url));
	if (!pending.has(url)) {
		const job = line.then(() => render(url)).catch(() => url).then((result) => {
			done.set(url, result);
			pending.delete(url);
			return result;
		});
		pending.set(url, job);
		line = job;
	}
	return pending.get(url);
};

export const useAvatarSrc = (src) => {
	const direct = !src || turnsItself();
	const [shown, setShown] = useState(() => (direct ? src : done.get(src) || null));

	useEffect(() => {
		if (direct) {
			setShown(src);
			return undefined;
		}
		let live = true;
		setShown(done.get(src) || null);
		if (!done.has(src)) uprightSrc(src).then((result) => live && setShown(result));
		return () => {
			live = false;
		};
	}, [src, direct]);

	return shown;
};

// Same props as an <img>. While the picture is being made it keeps its place and shows nothing.
const AvatarImage = ({src, alt = '', style, ...rest}) => {
	const shown = useAvatarSrc(src);
	return shown
		? <img {...rest} alt={alt} style={style} src={shown} />
		: <img {...rest} alt={alt} style={{...style, visibility: 'hidden'}} />;
};

export default AvatarImage;
