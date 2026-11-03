// Smart Search answers the nearest 15 to 20 titles whatever they are, so a small library fills the row with unrelated ones
// behind the real matches. The plugin sends how close each one is when it is asked with its tuning flag (debug=true): a library
// item as {Card, Score, Similarity} and a Seerr entry with `similarity` added. Similarity (the multilingual model's cosine, rescaled)
// is the number to cut on: on the user's library a real match reads 0.5 to 0.8 and filler up to about 0.37, more in Romanian.
// Score also holds the plugin's boosts and is not comparable between the two rows.

// Under this a result is not offered, however weak the rest of its row is.
export const SMART_MIN_SIMILARITY = 0.45;
// Nor is one that falls this far below the best of its own row.
export const SMART_CLOSE_TO_BEST = 0.7;

// When any result carries no score (a plugin that ignores the flag, or one that changed it) nothing is cut.
const keepClose = (entries) => {
	if (entries.length === 0 || entries.some((entry) => typeof entry.similarity !== 'number' || Number.isNaN(entry.similarity))) {
		return entries.map((entry) => entry.value);
	}
	const best = Math.max(...entries.map((entry) => entry.similarity));
	const cut = Math.max(SMART_MIN_SIMILARITY, best * SMART_CLOSE_TO_BEST);
	return entries.filter((entry) => entry.similarity >= cut).map((entry) => entry.value);
};

// The answer of /Moonfin/SmartSearch as {items, seerr}, library items unwrapped to plain cards, in the order the plugin gave.
export const relevantSmartResults = (answer) => {
	const items = ((answer && answer.Items) || []).map((item) => (
		item && item.Card ? {value: item.Card, similarity: item.Similarity} : {value: item}
	));
	const seerr = ((answer && answer.Seerr) || []).map((entry) => ({value: entry, similarity: entry.similarity}));
	return {items: keepClose(items), seerr: keepClose(seerr)};
};
