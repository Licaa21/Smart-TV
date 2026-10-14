import {serverBlurredUrl} from './serverBlur';

const JELLYFIN = 'http://192.168.1.2:8096/Items/abc123/Images/Backdrop';
const EMBY = 'http://192.168.1.3:8096/emby/Items/42/Images/Backdrop';

beforeEach(() => {
	Object.defineProperty(window, 'innerWidth', {value: 1920, configurable: true});
});

describe('serverBlurredUrl', () => {
	test('asks the server for the blur at a fifth of the size and keeps the other params', () => {
		expect(serverBlurredUrl(`${JELLYFIN}?maxWidth=1280&quality=80&tag=t1`, 20))
			.toBe(`${JELLYFIN}?quality=80&tag=t1&maxWidth=384&blur=4`);
	});

	test('works the same on an Emby url', () => {
		expect(serverBlurredUrl(`${EMBY}?api_key=k&maxWidth=1920`, 30)).toBe(`${EMBY}?api_key=k&maxWidth=384&blur=6`);
	});

	test('sends a whole number for every blur option and never less than one', () => {
		expect([10, 20, 30, 40, 3].map((blur) => serverBlurredUrl(JELLYFIN, blur).split('blur=')[1])).toEqual(['2', '4', '6', '8', '1']);
	});

	test('replaces a blur the url already carries', () => {
		expect(serverBlurredUrl(`${JELLYFIN}?blur=9&maxHeight=500`, 10)).toBe(`${JELLYFIN}?maxWidth=384&blur=2`);
	});

	test('leaves artwork from anywhere else, and no blur at all, to the caller', () => {
		expect(serverBlurredUrl('https://image.tmdb.org/t/p/w1280/x.jpg', 20)).toBeNull();
		expect(serverBlurredUrl('http://srv/Moonfin/Games/lib/Games/g1/Thumb', 20)).toBeNull();
		expect(serverBlurredUrl(JELLYFIN, 0)).toBeNull();
		expect(serverBlurredUrl(JELLYFIN, null)).toBeNull();
		expect(serverBlurredUrl('', 20)).toBeNull();
		expect(serverBlurredUrl(null, 20)).toBeNull();
	});
});
