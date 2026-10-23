import {readTrailerManifest} from '../../../platform-vega/src/youtubeManifest';

// The shell takes each request as a posted string and answers with a moonfin:vega event
const sent = () => window.ReactNativeWebView.postMessage.mock.calls.map(([raw]) => JSON.parse(raw));
const answer = (payload) => window.dispatchEvent(new window.CustomEvent('moonfin:vega', {detail: {v: 1, type: 'MANIFEST', payload}}));

afterEach(() => {
	delete window.ReactNativeWebView;
});

test('has the shell read a manifest and hands back its text, or null when it was refused', async () => {
	window.ReactNativeWebView = {postMessage: jest.fn()};
	const read = readTrailerManifest('https://manifest.googlevideo.com/a');
	const refused = readTrailerManifest('https://manifest.googlevideo.com/b');
	const [first, second] = sent();
	expect(first).toMatchObject({type: 'READ_MANIFEST', payload: {url: 'https://manifest.googlevideo.com/a'}});

	answer({id: second.payload.id, status: 403, body: ''});
	answer({id: first.payload.id, status: 200, body: '#EXTM3U'});
	await expect(read).resolves.toBe('#EXTM3U');
	await expect(refused).resolves.toBeNull();
});

test('gives null at once without a shell', async () => {
	await expect(readTrailerManifest('https://manifest.googlevideo.com/a')).resolves.toBeNull();
});
