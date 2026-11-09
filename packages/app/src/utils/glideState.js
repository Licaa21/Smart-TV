// What the glide of focusScroll.js and the slide of slideScroll.js share, kept apart from both so the slide does not
// need Spotlight: the Smooth Scrolling switch, and whether a list is being slid up or down.

let smooth = true;
export const setSmoothScrolling = (on) => {
	smooth = on !== false;
};
export const smoothScrollingOn = () => smooth;

// Up and down, a list does not glide: it jumps and the slide draws the way there with a transform the GPU does. That is
// under way until these times, so the work that waits for a glide waits for the slide too: one for a slide that waits for
// the scrolling to be over (a guess, dropped with the slide), one for a slide that was let go, for as long as it takes.
let pendingUntil = 0;
let slideUntil = 0;
export const notePendingSlide = (ms) => {
	pendingUntil = Math.max(pendingUntil, Date.now() + ms);
};
export const noteSlide = (ms) => {
	slideUntil = Math.max(slideUntil, Date.now() + ms);
};
export const slideUnderway = () => Date.now() < Math.max(pendingUntil, slideUntil);
// A slide that was dropped before it was let go is not under way
export const endPendingSlide = () => {
	pendingUntil = 0;
};

// The glide's own writes to a scroll position are not moves for the slide to draw
let glideWriting = false;
export const writingGlide = (write) => {
	glideWriting = true;
	try {
		write();
	} finally {
		glideWriting = false;
	}
};
export const isWritingGlide = () => glideWriting;

// For the tests
export const resetGlideState = () => {
	pendingUntil = 0;
	slideUntil = 0;
	glideWriting = false;
};
