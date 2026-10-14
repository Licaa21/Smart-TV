import {buildForkNotes} from './playbackInfoNotes';

jest.mock('@enact/i18n/$L', () => (text) => text);

const stream = (type, extra) => ({Type: type, ...extra});
const fileOf = (streams) => ({MediaStreams: streams});

describe('buildForkNotes', () => {
	it('says nothing off a Samsung, where these settings are not offered', () => {
		expect(buildForkNotes({method: 'transcode', source: {MediaStreams: Array.from({length: 40}, () => stream('Subtitle'))}, reasonKeys: ['streamcountexceedslimit']})).toEqual([]);
	});

	describe('many streams', () => {
		const many = fileOf(Array.from({length: 40}, (_, i) => stream('Subtitle', {Index: i})));

		it('names the setting that would let the file play as it is, and that it is the only thing stopping it', () => {
			const [note] = buildForkNotes({tizen: true, method: 'transcode', source: many, reasonKeys: ['streamcountexceedslimit'], settings: {}});
			expect(note).toMatchObject({id: 'streams', tone: 'tip', title: 'Allow Files With Many Streams'});
			expect(note.text).toContain('40 streams');
			expect(note.text).toContain('Nothing else stops it.');
		});

		it('leaves out "nothing else" when another reason is there too', () => {
			const [note] = buildForkNotes({tizen: true, method: 'transcode', source: many, reasonKeys: ['streamcountexceedslimit', 'audiocodecnotsupported'], settings: {}});
			expect(note.text).not.toContain('Nothing else');
		});

		it('says the setting is why a file over the limit plays as it is', () => {
			const [note] = buildForkNotes({tizen: true, method: 'direct', source: many, settings: {allowManyStreams: true}});
			expect(note).toMatchObject({id: 'streams', tone: 'info'});
		});

		it('is quiet about a small file', () => {
			expect(buildForkNotes({tizen: true, method: 'direct', source: fileOf([stream('Video')]), settings: {allowManyStreams: true}})).toEqual([]);
		});
	});

	describe('AV1', () => {
		const av1 = fileOf([stream('Video', {Codec: 'av1'})]);

		it('offers the setting when the picture would have to be copied into a server stream', () => {
			expect(buildForkNotes({tizen: true, method: 'transcode', source: av1, settings: {}})[0]).toMatchObject({id: 'av1', tone: 'tip'});
		});

		it('says the setting is re-encoding it when it is on', () => {
			const [note] = buildForkNotes({tizen: true, method: 'transcode', source: av1, settings: {forceCompatibleAv1Transcode: true}});
			expect(note.tone).toBe('info');
			expect(note.text).toContain('AV1 with AC3 audio plays as it is from MKV');
		});

		it('has nothing to say about an AV1 file that plays as it is', () => {
			expect(buildForkNotes({tizen: true, method: 'direct', source: av1, settings: {}})).toEqual([]);
		});
	});

	it('explains the Dolby Vision enhancement layer both ways round', () => {
		const dovi = fileOf([stream('Video', {Codec: 'hevc', VideoRangeType: 'DOVIWithEL'})]);
		expect(buildForkNotes({tizen: true, method: 'transcode', source: dovi, reasonKeys: ['videorangetypenotsupported'], settings: {}})[0]).toMatchObject({id: 'dolby', tone: 'tip'});
		expect(buildForkNotes({tizen: true, method: 'direct', source: dovi, settings: {dolbyVisionAsHdr10: true}})[0]).toMatchObject({id: 'dolby', tone: 'info'});
		expect(buildForkNotes({tizen: true, method: 'transcode', source: dovi, reasonKeys: ['audiocodecnotsupported'], settings: {}})).toEqual([]);
	});

	it('explains HEVC level 5.2 on a 4K file, with the level as people write it', () => {
		const hevc = fileOf([stream('Video', {Codec: 'hevc', Level: 156, Width: 3840})]);
		const [tip] = buildForkNotes({tizen: true, method: 'transcode', source: hevc, reasonKeys: ['videolevelnotsupported'], settings: {}});
		expect(tip).toMatchObject({id: 'hevc', tone: 'tip'});
		expect(tip.text).toContain('Level 5.2');
		expect(buildForkNotes({tizen: true, method: 'direct', source: hevc, settings: {allowHevcLevel52: true}})[0].tone).toBe('info');
		expect(buildForkNotes({tizen: true, method: 'transcode', source: fileOf([stream('Video', {Codec: 'hevc', Level: 156, Width: 1920})]), reasonKeys: ['videolevelnotsupported'], settings: {}})).toEqual([]);
	});
});

describe('what a note points at', () => {
	it('names the setting it is about, so the popup can open it', () => {
		const many = {MediaStreams: Array.from({length: 40}, (_, i) => ({Type: 'Subtitle', Index: i}))};
		const [note] = buildForkNotes({tizen: true, method: 'transcode', source: many, reasonKeys: ['streamcountexceedslimit'], settings: {}});
		expect(note.settingKey).toBe('allowManyStreams');
		const [av1] = buildForkNotes({tizen: true, method: 'transcode', source: {MediaStreams: [{Type: 'Video', Codec: 'av1'}]}, reasonKeys: [], settings: {}});
		expect(av1.settingKey).toBe('forceCompatibleAv1Transcode');
	});
});
