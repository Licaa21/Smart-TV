import {forgetMetadataLanguage, isEnglish, resolveMetadataLanguage, tmdbLanguage} from './metadataLanguage';

describe('tmdbLanguage', () => {
	it('sends the language alone, since the server country is a release region', () => {
		expect(tmdbLanguage('ro')).toBe('ro');
		expect(tmdbLanguage(' pt-BR ')).toBe('pt-BR');
		expect(tmdbLanguage('')).toBeNull();
	});

	it('knows English by its code', () => {
		expect(isEnglish('en-US')).toBe(true);
		expect(isEnglish('en')).toBe(true);
		expect(isEnglish('ro-RO')).toBe(false);
		expect(isEnglish(undefined)).toBe(false);
	});
});

describe('resolveMetadataLanguage', () => {
	beforeEach(() => {
		forgetMetadataLanguage();
		localStorage.clear();
	});

	it('reads the language the server is set to', async () => {
		const api = {getServerConfiguration: jest.fn().mockResolvedValue({PreferredMetadataLanguage: 'ro', MetadataCountryCode: 'US'})};
		await expect(resolveMetadataLanguage(api, 'a')).resolves.toBe('ro');
		await resolveMetadataLanguage(api, 'a');
		expect(api.getServerConfiguration).toHaveBeenCalledTimes(1);
	});

	it('uses the app language where the settings cannot be read', async () => {
		localStorage.setItem('moonfin_uiLanguage', 'ro-RO');
		const api = {getServerConfiguration: jest.fn().mockRejectedValue(new Error('403'))};
		await expect(resolveMetadataLanguage(api, 'b')).resolves.toBe('ro-RO');
	});

	it('keeps a refusal for the session, and tries again after a server that could not be reached', async () => {
		localStorage.setItem('moonfin_uiLanguage', 'ro-RO');
		const refused = Object.assign(new Error('403'), {status: 403});
		const api = {getServerConfiguration: jest.fn().mockRejectedValue(refused)};
		await resolveMetadataLanguage(api, 'd');
		await resolveMetadataLanguage(api, 'd');
		expect(api.getServerConfiguration).toHaveBeenCalledTimes(1);

		const down = {getServerConfiguration: jest.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({PreferredMetadataLanguage: 'fr'})};
		await expect(resolveMetadataLanguage(down, 'e')).resolves.toBe('ro-RO');
		await expect(resolveMetadataLanguage(down, 'e')).resolves.toBe('fr');

		const hiccup = {getServerConfiguration: jest.fn().mockRejectedValueOnce(Object.assign(new Error('500'), {status: 500})).mockResolvedValueOnce({PreferredMetadataLanguage: 'de'})};
		await resolveMetadataLanguage(hiccup, 'f');
		await expect(resolveMetadataLanguage(hiccup, 'f')).resolves.toBe('de');
	});

	it('gives up on a server that does not answer, and asks again next time', async () => {
		jest.useFakeTimers();
		try {
			localStorage.setItem('moonfin_uiLanguage', 'ro-RO');
			const api = {getServerConfiguration: jest.fn(() => new Promise(() => {}))};
			const answer = resolveMetadataLanguage(api, 'g');
			await jest.advanceTimersByTimeAsync(4000);
			await expect(answer).resolves.toBe('ro-RO');
			resolveMetadataLanguage(api, 'g');
			await jest.advanceTimersByTimeAsync(0);
			expect(api.getServerConfiguration).toHaveBeenCalledTimes(2);
		} finally {
			jest.useRealTimers();
		}
	});

	it('ends on English with nothing else to go on', async () => {
		const api = {getServerConfiguration: jest.fn().mockResolvedValue({})};
		await expect(resolveMetadataLanguage(api, 'c')).resolves.toBe('en-US');
	});
});
