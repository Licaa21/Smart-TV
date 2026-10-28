import {serverBlurredUrl} from './serverBlur';

// The backdrop behind a card is the server's own small blurred copy of the picture. Loading it for the cards around focus
// ahead of time leaves the layer's own load answering from memory, so the picture is there when focus rests. A picture
// made soft by the screen (Seerr and TMDB titles) is not loaded ahead: making one decodes a large picture, which a TV
// answers slowly.
const HELD_MAX = 16;
// Held so that the engine keeps the picture while the cards nearby are moved through, oldest let go first. wanted counts the
// cards that ask for it: the same title can stand in two rows, and one card leaving must not stop what the other waits for.
const held = new Map();

export const forgetWarmedBackdrops = () => held.clear();

// Loads the backdrop of the picture at url for that blur, or does nothing when the server does not make it. Returns what
// to call when the card is let go: a picture still on its way is stopped once no card wants it, one that came in is kept.
export const warmBackdrop = (url, blur) => {
	const address = url ? serverBlurredUrl(url, blur) : null;
	if (!address || typeof window === 'undefined' || typeof window.Image !== 'function') return () => {};
	let entry = held.get(address);
	if (entry) {
		held.delete(address);
	} else {
		const art = new window.Image();
		art.src = address;
		entry = {art, wanted: 0};
	}
	entry.wanted += 1;
	held.set(address, entry);
	while (held.size > HELD_MAX) held.delete(held.keys().next().value);
	let released = false;
	return () => {
		if (released) return;
		released = true;
		entry.wanted -= 1;
		if (entry.wanted <= 0 && !entry.art.complete && held.get(address) === entry) {
			entry.art.src = '';
			held.delete(address);
		}
	};
};
