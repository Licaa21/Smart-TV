import {describeHlsManifest, firstMediaPlaylistUrl, firstVariantUri, redactToken} from './hlsManifestProbe';

describe('hlsManifestProbe', () => {
	afterEach(() => {
		delete global.fetch;
	});

	it('hides the token in an address', () => {
		expect(redactToken('main.m3u8?a=1&api_key=SECRET&b=2')).toBe('main.m3u8?a=1&api_key=…&b=2');
		expect(redactToken('x?ApiKey=SECRET')).toBe('x?ApiKey=…');
	});

	it('finds the media playlist a master points at', () => {
		const master = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1,CODECS="av01.0.12M.10,ac-3"\nmain.m3u8?x=1\n';
		expect(firstVariantUri(master)).toBe('main.m3u8?x=1');
		expect(firstVariantUri('#EXTM3U\n#EXTINF:6,\nseg0.mp4')).toBeNull();
	});

	it('reads the master and the first media playlist, with the token hidden', async () => {
		const master = '#EXTM3U\n#EXT-X-STREAM-INF:CODECS="av01.0.12M.10,ac-3"\nmain.m3u8?api_key=SECRET\n';
		const media = '#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-MAP:URI="init.mp4?api_key=SECRET"\n';
		global.fetch = jest.fn((url) => Promise.resolve({ok: true, text: () => Promise.resolve(url.includes('main.m3u8') ? media : master)}));
		const info = await describeHlsManifest('http://server/videos/1/master.m3u8?api_key=SECRET');
		expect(info.master).toContain('CODECS="av01.0.12M.10,ac-3"');
		expect(info.master).not.toContain('SECRET');
		expect(info.media).toContain('#EXT-X-VERSION:7');
		expect(info.media).not.toContain('SECRET');
		expect(global.fetch.mock.calls[1][0]).toBe('http://server/videos/1/main.m3u8?api_key=SECRET');
	});

	it('gives the first media playlist of a master, and nothing for a playlist that is not one', async () => {
		const serve = (text) => { global.fetch = jest.fn(() => Promise.resolve({ok: true, text: () => Promise.resolve(text)})); };
		serve(['#EXTM3U', '#EXT-X-STREAM-INF:BANDWIDTH=1', 'main.m3u8?x=1', '#EXT-X-STREAM-INF:BANDWIDTH=2', 'other.m3u8', ''].join('\n'));
		expect(await firstMediaPlaylistUrl('http://server/videos/1/master.m3u8?k=1')).toBe('http://server/videos/1/main.m3u8?x=1');
		serve(['#EXTM3U', '#EXTINF:6,', 'seg.mp4', ''].join('\n'));
		expect(await firstMediaPlaylistUrl('http://server/videos/1/main.m3u8')).toBeNull();
	});
});
