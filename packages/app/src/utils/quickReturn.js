// Back on a screen that has been scrolled returns it to its start instead of
// leaving. The threshold keeps a stray pixel of drift from eating a press that
// was meant to leave.

const SCROLLED_AWAY_PX = 20;

export const isScrolledAway = (node) =>
	!!node && (node.scrollTop > SCROLLED_AWAY_PX || node.scrollLeft > SCROLLED_AWAY_PX);

// An Enact list does its scrolling on an inner node, so the check has to look
// below the container its spotlight id addresses.
export const isListScrolledAway = (spotlightId) => {
	if (typeof document === 'undefined') return false;
	const root = document.querySelector(`[data-spotlight-id="${spotlightId}"]`);
	if (!root) return false;
	// A grid that slides its rows with a transform says so itself, since nothing in it scrolls.
	if (isScrolledAway(root) || root.getAttribute('data-scrolled') === 'true') return true;
	const nodes = root.querySelectorAll('div');
	for (let i = 0; i < nodes.length; i++) {
		if (isScrolledAway(nodes[i])) return true;
	}
	return false;
};
