import JSZip from 'jszip';
import {openComicPages} from './comicPages';

const blobText = (blob) => new Promise((resolve) => {
	const reader = new window.FileReader();
	reader.onload = () => resolve(reader.result);
	reader.readAsText(blob);
});

test('a zip comic lists its pages in order and reads one when asked', async () => {
	const zip = new JSZip();
	zip.file('pages/p10.jpg', 'ten');
	zip.file('pages/p2.jpg', 'two');
	zip.file('info.txt', 'not a page');
	const buffer = await zip.generateAsync({type: 'arraybuffer'});

	const source = await openComicPages(buffer, 'zip');
	expect(source.names).toEqual(['pages/p2.jpg', 'pages/p10.jpg']);
	expect(await blobText(await source.load(1))).toBe('ten');
});

test('a tar comic reads a page straight out of the archive', async () => {
	const header = new Uint8Array(512);
	'p1.jpg'.split('').forEach((c, i) => {
		header[i] = c.charCodeAt(0);
	});
	'00000000003'.split('').forEach((c, i) => {
		header[124 + i] = c.charCodeAt(0);
	});
	header[156] = '0'.charCodeAt(0);
	const data = new Uint8Array(512);
	data.set(Uint8Array.from('one', (c) => c.charCodeAt(0)));
	const buffer = new Uint8Array(512 * 4);
	buffer.set(header, 0);
	buffer.set(data, 512);

	const source = await openComicPages(buffer.buffer, 'tar');
	expect(source.names).toEqual(['p1.jpg']);
	expect(await blobText(await source.load(0))).toBe('one');
});
