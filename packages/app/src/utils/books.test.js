import {
	bookExtension, bookReader, EPUB_TICKS, epubTicks, isBookItem, newerServerEpubFraction,
	readTarEntries, sortPages, startPage, supportsNewerBookFormats
} from './books';

const ascii = (value) => Uint8Array.from(value, (c) => c.charCodeAt(0));
const text = (bytes) => String.fromCharCode.apply(null, bytes);

const tarHeader = (name, size, type = '0') => {
	const header = new Uint8Array(512);
	for (let i = 0; i < name.length && i < 100; i++) header[i] = name.charCodeAt(i);
	const sizeField = size.toString(8).padStart(11, '0');
	for (let i = 0; i < 11; i++) header[124 + i] = sizeField.charCodeAt(i);
	header[156] = type.charCodeAt(0);
	return header;
};

const tar = (files) => {
	const parts = [];
	files.forEach(({name, data, type}) => {
		const bytes = ascii(data);
		parts.push(tarHeader(name, bytes.length, type));
		const padded = new Uint8Array(Math.ceil(bytes.length / 512) * 512);
		padded.set(bytes);
		parts.push(padded);
	});
	parts.push(new Uint8Array(1024));
	const total = parts.reduce((sum, part) => sum + part.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	parts.forEach((part) => {
		out.set(part, offset);
		offset += part.length;
	});
	return out.buffer;
};

describe('bookReader', () => {
	test('picks the reader from the file extension', () => {
		expect(bookReader({Path: '/books/Dune.epub'})).toEqual({ext: 'epub', kind: 'epub'});
		expect(bookReader({Path: '/comics/Batman #12.CBZ'})).toEqual({ext: 'cbz', kind: 'comic', archive: 'zip'});
		expect(bookReader({Path: '/comics/old.cbt'})).toEqual({ext: 'cbt', kind: 'comic', archive: 'tar'});
	});

	test('marks the formats that need a newer TV', () => {
		expect(bookReader({Path: 'a.cbr'})).toEqual({ext: 'cbr', kind: 'comic', archive: 'rar', newer: true});
		expect(bookReader({Path: 'a.cb7'})).toEqual({ext: 'cb7', kind: 'comic', archive: '7z', newer: true});
		expect(bookReader({Path: 'a.pdf'})).toEqual({ext: 'pdf', kind: 'pdf', newer: true});
	});

	test('has no reader for Kindle books', () => {
		expect(bookReader({Path: '/books/Dune.azw3'})).toBeNull();
		expect(bookReader({Path: '/books/Dune.mobi'})).toBeNull();
	});

	test('reads a Windows path, a media source, then the container', () => {
		expect(bookExtension({Path: 'D:\\Books\\Dune.epub'})).toBe('epub');
		expect(bookExtension({MediaSources: [{Path: '/x/y.pdf'}]})).toBe('pdf');
		expect(bookExtension({Container: 'EPUB'})).toBe('epub');
		expect(bookExtension({Path: '/books/no-extension'})).toBeNull();
	});

	test('knows a book by its type or media type', () => {
		expect(isBookItem({Type: 'Book'})).toBe(true);
		expect(isBookItem({Type: 'Video', MediaType: 'Book'})).toBe(true);
		expect(isBookItem({Type: 'AudioBook', MediaType: 'Audio'})).toBe(false);
	});
});

test('the newer formats are off where workers are missing', () => {
	expect(typeof Worker).toBe('undefined');
	expect(supportsNewerBookFormats()).toBe(false);
});

describe('page progress', () => {
	test('opens at the saved page on the jellyfin-web scale', () => {
		expect(startPage({UserData: {PlaybackPositionTicks: 30000}}, 12)).toBe(3);
		expect(startPage({UserData: {PlaybackPositionTicks: 0}}, 12)).toBe(0);
		expect(startPage({}, 12)).toBe(0);
	});

	test('a saved page past the end opens at the start', () => {
		expect(startPage({UserData: {PlaybackPositionTicks: 900000}}, 12)).toBe(0);
	});
});

describe('EPUB progress', () => {
	test('ticks are the fraction of one second, clamped', () => {
		expect(epubTicks(0.25)).toBe(2500000);
		expect(epubTicks(1.5)).toBe(EPUB_TICKS);
		expect(epubTicks(-1)).toBe(0);
	});

	test('a saved location comes back through epub.js percentages', () => {
		// epub.js reports location / total and restores ceil(total * fraction).
		[7, 300, 1023, 4096].forEach((total) => {
			for (let location = 0; location <= total; location++) {
				const restored = Math.ceil(total * epubTicks(location / total) / EPUB_TICKS);
				expect(restored).toBe(location);
			}
		});
	});

	const item = (ticks, lastPlayed) => ({UserData: {PlaybackPositionTicks: ticks, LastPlayedDate: lastPlayed}});
	const local = {ticks: 6000000, savedAt: Date.parse('2026-10-17T12:00:00Z')};

	test('the server place wins when this TV has none', () => {
		expect(newerServerEpubFraction(item(2500000), null)).toBe(0.25);
		expect(newerServerEpubFraction(item(0), null)).toBeNull();
	});

	test('a later save on another device wins', () => {
		expect(newerServerEpubFraction(item(4000000, '2026-10-17T12:05:00Z'), local)).toBe(0.4);
	});

	test('the position this TV reported keeps its exact place', () => {
		expect(newerServerEpubFraction(item(6000000, '2026-10-17T12:00:01Z'), local)).toBeNull();
	});

	test("this TV's later save wins over an older server position", () => {
		expect(newerServerEpubFraction(item(4000000, '2026-10-17T11:55:00Z'), local)).toBeNull();
	});
});

test("pages sort by their numbers and skip what isn't a page", () => {
	expect(sortPages(['p10.jpg', 'p2.jpg', 'p1.png', 'notes.txt', '__MACOSX/._p1.png', 'folder/'])).toEqual(['p1.png', 'p2.jpg', 'p10.jpg']);
});

describe('readTarEntries', () => {
	test('lists each file with where its bytes start', () => {
		const buffer = tar([{name: 'pages/01.jpg', data: 'one'}, {name: 'pages/02.jpg', data: 'second page'}]);
		const entries = readTarEntries(buffer);
		expect(entries.map((e) => [e.name, e.size])).toEqual([['pages/01.jpg', 3], ['pages/02.jpg', 11]]);
		expect(text(new Uint8Array(buffer, entries[1].offset, entries[1].size))).toBe('second page');
	});

	test('reads GNU long names and pax paths', () => {
		const long = 'a'.repeat(120) + '.jpg';
		const buffer = tar([
			{name: '././@LongLink', data: long, type: 'L'},
			{name: 'cut-off', data: 'x'},
			{name: 'PaxHeader', data: '30 path=pax/very/long/name.jpg\n', type: 'x'},
			{name: 'short', data: 'y'},
			{name: 'dir/', data: '', type: '5'}
		]);
		expect(readTarEntries(buffer).map((e) => e.name)).toEqual([long, 'pax/very/long/name.jpg']);
	});
});
