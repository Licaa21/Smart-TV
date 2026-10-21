// One <video> element is shared by the media bar trailer and the card preview, so
// whoever wants it next has to put the current user's stream away first. A claim runs
// the previous owner's evict before it returns, which leaves the element clean by the
// time the caller sets its src.

let owner = null;
let evictOwner = null;

export const claimSharedVideo = (nextOwner, evict) => {
	if (owner && owner !== nextOwner && evictOwner) {
		const previousEvict = evictOwner;
		try {
			previousEvict();
		} catch (e) {
			// The new owner takes the element either way.
		}
	}
	owner = nextOwner;
	evictOwner = evict || null;
};

export const releaseSharedVideo = (who) => {
	if (owner !== who) return;
	owner = null;
	evictOwner = null;
};

export const ownsSharedVideo = (who) => owner === who;

// Music the viewer backed out of keeps playing behind the screens. A trailer or card
// preview would stop it, on webOS by taking this very element, so they hold off until
// the music ends.
let musicPlaying = false;
export const setMusicPlaying = (playing) => {
	musicPlaying = playing;
};
export const isMusicPlaying = () => musicPlaying;
