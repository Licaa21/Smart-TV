// The app reads the back key on window before anything mounted later can, so the episode
// dialog is dismissed through the detail screen's back chain instead of listening for
// itself. It sits apart from the dialog so the request hook can reach it without pulling
// a component in behind it.

let closeOpenDialog = null;

export const registerSeerrEpisodeDialog = (close) => {
	closeOpenDialog = close;
};

export const unregisterSeerrEpisodeDialog = (close) => {
	if (closeOpenDialog === close) closeOpenDialog = null;
};

export const closeSeerrEpisodeDialog = () => {
	if (!closeOpenDialog) return false;
	closeOpenDialog();
	return true;
};
