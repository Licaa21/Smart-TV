import {READER_DEFAULTS, normalizeReaderSettings, readerPageStyle, readerTint} from './readerSettings';

describe('normalizeReaderSettings', () => {
	it('fills in the defaults for nothing stored', () => {
		expect(normalizeReaderSettings(null)).toEqual(READER_DEFAULTS);
	});

	it('drops unknown choices and holds numbers to their range', () => {
		const settings = normalizeReaderSettings({pageTheme: 'neon', fontScale: 4, brightness: 0, warmth: 'x', margin: 'wide', bold: true});
		expect(settings.pageTheme).toBe('original');
		expect(settings.fontScale).toBe(1.8);
		expect(settings.brightness).toBe(0.3);
		expect(settings.warmth).toBe(0);
		expect(settings.margin).toBe('wide');
		expect(settings.bold).toBe(true);
	});

	it('keeps the text size on tenths so stepping never drifts', () => {
		expect(normalizeReaderSettings({fontScale: 1.1000000000000001}).fontScale).toBe(1.1);
	});
});

describe('readerPageStyle', () => {
	it('scales the size, margin and column by the unit', () => {
		const style = readerPageStyle({...READER_DEFAULTS, pageTheme: 'paper', fontScale: 1.5, margin: 'narrow'}, {baseSize: 36, unit: 2});
		expect(style.bg).toBe('#f4ecd8');
		expect(style.size).toBe(54);
		expect(style.margin).toBe(24);
		expect(style.maxWidth).toBe(1840);
	});
});

describe('readerTint', () => {
	it('is nothing at full brightness with no warmth', () => {
		expect(readerTint(READER_DEFAULTS)).toBeNull();
	});

	it('dims and warms the page by a fixed share of each setting', () => {
		const tint = readerTint({brightness: 0.5, warmth: 1});
		expect(tint.dim).toBeCloseTo(0.35);
		expect(tint.warmth).toBeCloseTo(0.28);
	});
});
