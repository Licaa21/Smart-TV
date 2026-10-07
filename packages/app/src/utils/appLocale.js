// The language the app is shown in. It is not always the TV's own, and a date or a price written in the TV's
// language under another one reads as a mix, so formatting asks for this one. Left undefined it is the TV's.
export const appLocale = () => {
	try {
		const booted = localStorage.getItem('moonfin_uiLanguage');
		if (booted) return booted;
		return JSON.parse(localStorage.getItem('moonfin_settings') || '{}').uiLanguage || undefined;
	} catch (e) {
		return undefined;
	}
};
