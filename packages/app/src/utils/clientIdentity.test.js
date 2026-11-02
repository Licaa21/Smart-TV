import {clientIdentity} from './clientIdentity';

describe('clientIdentity', () => {
	test('a package the fork built is the fork, at the fork version', () => {
		expect(clientIdentity('Moonfin for Tizen', '2.10.0', '1.9.6')).toEqual({appName: "Moonfin Lica's Fork", appVersion: '1.9.6'});
	});

	test('anywhere else it keeps Moonfin\'s name and version', () => {
		expect(clientIdentity('Moonfin for Tizen', '2.10.0', undefined)).toEqual({appName: 'Moonfin for Tizen', appVersion: '2.10.0'});
		expect(clientIdentity('Moonfin for Tizen', '2.10.0', '')).toEqual({appName: 'Moonfin for Tizen', appVersion: '2.10.0'});
	});

	test('the name survives the header, which only drops quotes, backslashes, commas and non ASCII', () => {
		expect("Moonfin Lica's Fork").toMatch(/^[^"\,]+$/);
	});
});
