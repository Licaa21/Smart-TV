import ilib from 'ilib';

// Moonfin's interface language, which dates and amounts follow. Formatting without a locale goes
// by the TV's own language instead.
export const uiLocale = () => ilib.getLocale();
