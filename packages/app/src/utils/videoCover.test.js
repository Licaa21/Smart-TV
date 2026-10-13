import {coverVideoInBox, resetVideoBox} from './videoCover';

// jsdom lays nothing out, so the sizes are handed to the elements directly.
const sized = (element, props) => {
	Object.keys(props).forEach((name) => {
		Object.defineProperty(element, name, {configurable: true, get: () => props[name]});
	});
	return element;
};

const wideVideo = () => sized(document.createElement('video'), {videoWidth: 1280, videoHeight: 720});
const posterBox = () => sized(document.createElement('div'), {clientWidth: 240, clientHeight: 360});

describe('coverVideoInBox', () => {
	test('scales a 16:9 video to fill a poster box and centers the overhang', () => {
		const video = wideVideo();

		expect(coverVideoInBox(video, posterBox())).toBe(true);
		expect(video.style.width).toBe('640px');
		expect(video.style.height).toBe('360px');
		expect(video.style.left).toBe('-200px');
		expect(video.style.top).toBe('0px');
	});

	test('a zoom grows it past the box on both sides', () => {
		const video = wideVideo();

		coverVideoInBox(video, posterBox(), 1.15);

		expect(video.style.width).toBe('736px');
		expect(video.style.height).toBe('414px');
		expect(video.style.left).toBe('-248px');
		expect(video.style.top).toBe('-27px');
	});

	test('does nothing until the video knows its size or the box has one', () => {
		const unsized = document.createElement('video');
		const video = wideVideo();
		const emptyBox = sized(document.createElement('div'), {clientWidth: 0, clientHeight: 0});

		expect(coverVideoInBox(unsized, posterBox())).toBe(false);
		expect(coverVideoInBox(video, emptyBox)).toBe(false);
		expect(coverVideoInBox(video, null)).toBe(false);
		expect(video.style.width).toBe('');
	});
});

describe('resetVideoBox', () => {
	test('puts the element back to filling its holder', () => {
		const video = wideVideo();
		coverVideoInBox(video, posterBox());

		resetVideoBox(video);

		expect(video.style.width).toBe('100%');
		expect(video.style.height).toBe('100%');
		expect(video.style.left).toBe('0px');
		expect(video.style.top).toBe('0px');
	});
});
