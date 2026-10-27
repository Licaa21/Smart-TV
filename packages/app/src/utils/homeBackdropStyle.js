// The synced switch still says whether Home shows a backdrop, so an app that only knows the
// switch keeps working, and the style picks where it goes once it's on.
export const homeBackdropStyle = (settings) => {
	if (settings?.showHomeBackdrop === false) return 'off';
	return settings?.homeBackdropStyle === 'corner' ? 'corner' : 'fullScreen';
};

export const homeBackdropSettings = (style) => ({
	showHomeBackdrop: style !== 'off',
	homeBackdropStyle: style
});
