// The cards of Continue Watching and Next Up whose details screens may be opened: Home says what it shows, and the backdrop
// behind each is read ahead (utils/detailsBackdrop.js).

// [rows] are the rows Home draws, in order. All cards of the merged row, or of both rows, in the order Home shows them; a
// title of another server, or one of Seerr or an outside list, is left out, since its screen draws another way.
export const pickBackdropTargets = (rows) => {
	const all = (id) => ((rows || []).find((row) => row.id === id)?.items || []).filter((item) => item?.Id && !item._serverUrl && !item._seerr && !item._external);
	const merged = all('continue-nextup');
	const picked = merged.length ? merged : [...all('resume'), ...all('nextup')];
	const seen = new Set();
	return picked.filter((item) => {
		if (seen.has(item.Id)) return false;
		seen.add(item.Id);
		return true;
	});
};
