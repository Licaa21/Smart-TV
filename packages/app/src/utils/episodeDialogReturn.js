// Where an episode dialog was when a guest star's page was opened from it, so Back from that page finds the dialog
// open again on the same episode with the same star in focus. The detail screen is built again on the way back,
// so what it needs is kept here, apart from it. It is only read back by the title it was kept for, and a
// returning trip that never comes lets it go after a while.
const KEPT_MS = 30 * 60 * 1000;

let kept = null;

export const keepEpisodeDialog = (state) => {
	kept = {...state, at: Date.now()};
};

// The kept place if it belongs to one of these episodes, handed over once.
export const takeEpisodeDialog = (episodes) => {
	if (!kept) return null;
	if (Date.now() - kept.at > KEPT_MS) {
		kept = null;
		return null;
	}
	const episode = (episodes || []).find((candidate) => candidate.Id === kept.episodeId);
	if (!episode) return null;
	const back = {...kept, episode};
	kept = null;
	return back;
};

// Whether a place is kept for one of these episodes, without taking it. A screen that has to open on the part that holds
// the episodes asks this first.
export const hasKeptEpisodeDialog = (episodes) => Boolean(
	kept && Date.now() - kept.at <= KEPT_MS && (episodes || []).some((candidate) => candidate.Id === kept.episodeId)
);

export const dropEpisodeDialog = () => {
	kept = null;
};
