// Wide art fetched ahead of the cards that will wear it, so a card opens with its picture the moment focus lands.
//
// Fetches go nearest card first and only a few at a time, so the card about to be reached never waits behind
// ones that were asked for earlier and sit further off, or behind cards focus has already passed. The rank of
// a request is how near its card is to focus, and moves as focus does.

const MAX_ACTIVE = 4;

// Art that has already come in, so a card focused after its art arrived opens straight away.
const ART_MEMORY = 200;
const loaded = new Set();

export const hasArt = (url) => loaded.has(url);

export const rememberArt = (url) => {
	loaded.delete(url);
	loaded.add(url);
	if (loaded.size > ART_MEMORY) loaded.delete(loaded.values().next().value);
};

const waiting = [];
const active = new Set();

const pump = () => {
	while (active.size < MAX_ACTIVE && waiting.length > 0) {
		let next = 0;
		for (let i = 1; i < waiting.length; i++) {
			if (waiting[i].rank < waiting[next].rank) next = i;
		}
		const entry = waiting.splice(next, 1)[0];
		const art = new window.Image();
		entry.art = art;
		active.add(entry);
		const finish = () => {
			active.delete(entry);
			entry.art = null;
			pump();
		};
		art.onload = () => {
			rememberArt(entry.url);
			finish();
		};
		art.onerror = () => {
			entry.onFail?.();
			finish();
		};
		art.src = entry.url;
	}
};

// Asks for the art at url. onFail hears of a request that came back with nothing. The handle moves the rank
// of a request that is still waiting, and drops one that is waiting or under way.
export const prefetchArt = (url, rank, onFail) => {
	const entry = {url, rank, onFail, art: null};
	waiting.push(entry);
	pump();
	return {
		setRank: (next) => {
			entry.rank = next;
		},
		cancel: () => {
			const at = waiting.indexOf(entry);
			if (at >= 0) {
				waiting.splice(at, 1);
			} else if (active.has(entry)) {
				entry.art.onload = null;
				entry.art.onerror = null;
				entry.art.src = '';
				active.delete(entry);
				pump();
			}
		}
	};
};
