import {
	SEASONAL_HOLIDAYS,
	normalizeSeasonalHiddenHolidays,
	normalizeSeasonalRowCountry,
	seasonalCountryParam
} from './seasonalRow';

describe('normalizeSeasonalRowCountry', () => {
	test('keeps auto and other and upper cases a code', () => {
		expect(normalizeSeasonalRowCountry('auto')).toBe('auto');
		expect(normalizeSeasonalRowCountry('Other')).toBe('other');
		expect(normalizeSeasonalRowCountry('ca')).toBe('CA');
	});

	test('answers undefined for anything else, so the local choice stays', () => {
		expect(normalizeSeasonalRowCountry('everywhere')).toBeUndefined();
		expect(normalizeSeasonalRowCountry('')).toBeUndefined();
		expect(normalizeSeasonalRowCountry(null)).toBeUndefined();
	});
});

describe('normalizeSeasonalHiddenHolidays', () => {
	test('keeps only known holidays and refuses anything that is not a list', () => {
		expect(normalizeSeasonalHiddenHolidays(['pride', 'bogus', 'easter'])).toEqual(['pride', 'easter']);
		expect(normalizeSeasonalHiddenHolidays('pride')).toBeUndefined();
		expect(SEASONAL_HOLIDAYS).toHaveLength(9);
	});
});

describe('seasonalCountryParam', () => {
	test('automatic sends the device country when it is a two letter code', () => {
		expect(seasonalCountryParam('auto', 'us')).toBe('US');
		expect(seasonalCountryParam(undefined, 'CA')).toBe('CA');
		expect(seasonalCountryParam('auto', null)).toBeNull();
		expect(seasonalCountryParam('auto', '419')).toBeNull();
	});

	test('other sends the code Moonbase reads as no country', () => {
		expect(seasonalCountryParam('other', 'US')).toBe('ZZ');
	});

	test('a chosen country is sent as is, whatever the device says', () => {
		expect(seasonalCountryParam('ca', 'US')).toBe('CA');
		expect(seasonalCountryParam('everywhere', 'US')).toBeNull();
	});
});
