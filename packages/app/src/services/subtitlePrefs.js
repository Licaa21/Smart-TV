import {getFromStorage, saveToStorage} from './storage';
import {createSeriesTrackPref, toSeriesTrackPref} from '../utils/seriesTrackPrefs';

// Remembers the tracks a user picked so they don't have to be reselected on every
// play. The per-item index restores the exact subtitle when replaying the same
// title, and the per-series record carries a choice to other episodes, matched by
// what the track was rather than where it sat, because episodes list their tracks
// in different orders. Mirrors Moonfin Core's per-item and per-series preferences.

const STORAGE_KEY = 'subtitlePrefs';
const MAX_ITEMS = 300;

const OFF_INDEX = -1;

// Series entries used to be the language on its own, where an empty one meant off.
// They are brought up to the record form on the way in, so anything saved before
// keeps working and is rewritten in the new shape the next time it is touched.
const readSeries = (stored) => {
	const out = {};
	if (stored && typeof stored === 'object') {
		for (const [id, value] of Object.entries(stored)) {
			const pref = toSeriesTrackPref(value);
			if (pref) out[id] = pref;
		}
	}
	return out;
};

const loadPrefs = async () => {
	const stored = await getFromStorage(STORAGE_KEY);
	return {
		items: stored?.items && typeof stored.items === 'object' ? stored.items : {},
		series: readSeries(stored?.series),
		seriesAudio: readSeries(stored?.seriesAudio),
		secondaryItems: stored?.secondaryItems && typeof stored.secondaryItems === 'object' ? stored.secondaryItems : {}
	};
};

// Every save reads the whole record and writes it back, so two landing together, like a
// primary pick that also clears the second track, would drop one. They take turns instead.
let writeQueue = Promise.resolve();
const updatePrefs = (change) => {
	const run = writeQueue.then(async () => {
		const prefs = await loadPrefs();
		change(prefs);
		await saveToStorage(STORAGE_KEY, prefs);
	});
	writeQueue = run.catch(() => {});
	return run;
};

// Reinsert so the freshest item sits last, then trim the oldest once over the cap.
const remember = (map, id, value) => {
	delete map[id];
	map[id] = value;
	const ids = Object.keys(map);
	if (ids.length > MAX_ITEMS) {
		for (const old of ids.slice(0, ids.length - MAX_ITEMS)) {
			delete map[old];
		}
	}
};

// `streams` is every subtitle track the episode offers, which is what tells the
// pick apart from the others in its language.
export const saveSubtitlePref = async (item, streamIndex, streams) => {
	if (!item?.Id) return;
	await updatePrefs((prefs) => {
		remember(prefs.items, item.Id, streamIndex >= 0 ? streamIndex : OFF_INDEX);

		if (item.SeriesId) {
			const pref = createSeriesTrackPref(streams, streamIndex);
			if (pref) prefs.series[item.SeriesId] = pref;
			else delete prefs.series[item.SeriesId];
		}
	});
};

export const saveAudioPref = async (item, streamIndex, streams) => {
	if (!item?.SeriesId) return;
	await updatePrefs((prefs) => {
		// Turning audio off isn't a thing, so a pick that names no track leaves the
		// series without an opinion rather than storing one.
		const pref = streamIndex >= 0 ? createSeriesTrackPref(streams, streamIndex) : null;
		if (pref) prefs.seriesAudio[item.SeriesId] = pref;
		else delete prefs.seriesAudio[item.SeriesId];
	});
};

// The second track is only remembered per item, and off is remembered too so a track
// turned off stays off on the next play.
export const saveSecondarySubtitlePref = async (item, selection) => {
	if (!item?.Id) return;
	await updatePrefs((prefs) => {
		remember(prefs.secondaryItems, item.Id, selection);
	});
};

export const getItemSecondarySubtitlePref = async (itemId) => {
	if (!itemId) return undefined;
	const prefs = await loadPrefs();
	return prefs.secondaryItems[itemId];
};

export const getItemSubtitlePref = async (itemId) => {
	if (!itemId) return undefined;
	const prefs = await loadPrefs();
	return Object.prototype.hasOwnProperty.call(prefs.items, itemId) ? prefs.items[itemId] : undefined;
};

export const getSeriesSubtitlePref = async (seriesId) => {
	if (!seriesId) return undefined;
	const prefs = await loadPrefs();
	return prefs.series[seriesId];
};

export const getSeriesAudioPref = async (seriesId) => {
	if (!seriesId) return undefined;
	const prefs = await loadPrefs();
	return prefs.seriesAudio[seriesId];
};
