import ilib from 'ilib';

import {formatPersonDate} from './personCredits';
import {formatCurrency} from './seerrBadges';

// Whatever language the environment runs in, dates and amounts follow the one the interface is set to.
describe('formatting in the interface language', () => {
	afterEach(() => ilib.setLocale('en-US'));

	test('a date is written in the interface language', () => {
		ilib.setLocale('es-ES');
		expect(formatPersonDate('1975-01-05')).toBe('5 de enero de 1975');
	});

	test('an amount groups and places its symbol the interface way', () => {
		ilib.setLocale('de-DE');
		expect(formatCurrency(1500000)).toBe('1.500.000,00\u00a0$');
		ilib.setLocale('en-US');
		expect(formatCurrency(1500000)).toBe('$1,500,000.00');
	});
});
