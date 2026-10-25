import {bookFileName, bookFormatLine, fileName, fileSizeLine, trackRows, videoLines} from './nouveauFooterFields';

const MB = 1024 * 1024;

describe('videoLines', () => {
	it('reports what the file says it is, in order', () => {
		expect(videoLines({
			Codec: 'hevc',
			Profile: 'Main 10',
			Width: 1920,
			Height: 1080,
			RealFrameRate: 23.976,
			BitDepth: 10,
			VideoRange: 'HDR',
			VideoRangeType: 'DOVIWithHDR10'
		})).toEqual([
			'HEVC (Main 10)',
			'1920 \u00d7 1080',
			'23.976 fps',
			'10-bit',
			'HDR (DOVIWithHDR10)'
		]);
	});

	// The footer is not the player. It keeps the raw codec rather than expanding it, so what is on
	// screen matches what the server reported.
	it('leaves the codec as the server spelled it', () => {
		expect(videoLines({Codec: 'h264'})[0]).toBe('H264');
	});

	it('leaves out whatever the server was silent about', () => {
		expect(videoLines({Codec: 'av1', VideoRange: 'SDR'})).toEqual(['AV1', 'SDR']);
		expect(videoLines(null)).toEqual([]);
	});
});

describe('fileSizeLine', () => {
	it('names the size and the container together', () => {
		expect(fileSizeLine({Size: 700 * MB, Container: 'mkv'}))
			.toBe('Size: 700 MB  •  Format: MKV');
	});

	it('says nothing when it only has half of it', () => {
		expect(fileSizeLine({Size: 700 * MB})).toBeNull();
		expect(fileSizeLine({Container: 'mkv'})).toBeNull();
		expect(fileSizeLine(null)).toBeNull();
	});
});

describe('fileName', () => {
	it('prefers the name, and falls back to the end of the path', () => {
		expect(fileName({Name: 'Feature'})).toBe('Feature');
		expect(fileName({Path: '/media/films/Thing (1982).mkv'})).toBe('Thing (1982).mkv');
		expect(fileName({Path: 'C:\\media\\Thing.mkv'})).toBe('Thing.mkv');
		expect(fileName({})).toBeNull();
	});
});

describe('book file', () => {
	it('names the file and its format from the path', () => {
		const book = {Type: 'Book', Name: 'Dune', Path: '/books/Dune.epub'};
		expect(bookFileName(book)).toBe('Dune.epub');
		expect(bookFormatLine(book)).toBe('Format: .epub');
	});

	it('leaves the format out when the file has no extension', () => {
		const book = {Type: 'Book', Name: 'Dune', Path: '/books/Dune'};
		expect(bookFileName(book)).toBe('Dune');
		expect(bookFormatLine(book)).toBeNull();
	});

	it('falls back to the title without a path', () => {
		expect(bookFileName({Type: 'Book', Name: 'Dune'})).toBe('Dune');
	});
});

describe('trackRows', () => {
	it('names a track and the language it is in', () => {
		expect(trackRows([{DisplayTitle: 'Surround', Language: 'eng', Index: 1}], 1))
			.toEqual([{label: 'Surround (English)', detail: null, active: true}]);
	});

	it('falls back to the codec where there is no title', () => {
		expect(trackRows([{Codec: 'eac3', Language: 'jpn', Index: 2}], 1)[0].label)
			.toBe('EAC3 (Japanese)');
	});

	it('marks only the track being used', () => {
		const rows = trackRows([{Index: 1, Codec: 'aac'}, {Index: 2, Codec: 'ac3'}], 2);
		expect(rows.map((r) => r.active)).toEqual([false, true]);
	});

	// Forced means nothing on an audio track, so it is only asked about for subtitles.
	it('carries the flags, and forced only when asked', () => {
		const stream = {Codec: 'srt', Language: 'eng', Index: 3, IsDefault: true, IsForced: true};
		expect(trackRows([stream], 3, {includeForced: true})[0].detail).toBe('Default · Forced');
		expect(trackRows([stream], 3)[0].detail).toBe('Default');
	});

	it('has nothing to list when the file carries no tracks', () => {
		expect(trackRows()).toEqual([]);
	});
});
