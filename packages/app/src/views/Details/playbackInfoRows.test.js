import {buildPlaybackInfo, playMethod} from './playbackInfoRows';

jest.mock('@enact/i18n/$L', () => (text) => text);

const source = {
	Container: 'mkv',
	Bitrate: 20000000,
	MediaStreams: [
		{Type: 'Video', Index: 0, Codec: 'hevc', Width: 3840, Height: 2160},
		{Type: 'Audio', Index: 1, Codec: 'truehd', Channels: 8, DisplayTitle: 'English - TrueHD - 7.1'},
		{Type: 'Audio', Index: 2, Codec: 'ac3', Channels: 6, DisplayTitle: 'English - AC3 - 5.1', BitRate: 640000},
		{Type: 'Subtitle', Index: 3, Codec: 'subrip', DisplayTitle: 'English - SRT'}
	]
};

const overLimit = {...source, Bitrate: 64000000};

const answer = (overrides) => ({
	supportsDirectPlay: false,
	supportsDirectStream: false,
	transcodeReasons: [],
	source,
	deviceProfile: null,
	maxStreamingBitrate: 60000000,
	...overrides
});

const lines = (info, title) => info.sections.find((section) => section.title === title)?.lines;

describe('playMethod', () => {
	it('prefers direct play, then direct stream', () => {
		expect(playMethod({supportsDirectPlay: true, supportsDirectStream: true})).toBe('direct');
		expect(playMethod({supportsDirectPlay: false, supportsDirectStream: true})).toBe('stream');
		expect(playMethod({supportsDirectPlay: false, supportsDirectStream: false})).toBe('transcode');
	});
});

describe('buildPlaybackInfo', () => {
	it('does not call a direct play one when the app has the server build the picked audio', () => {
		const audioStart = {needsServer: true, openingCodec: 'eac3', wantedCodec: 'ac3'};
		const info = buildPlaybackInfo(answer({supportsDirectPlay: true}), {audioStreamIndex: 2, audioStart, tizen: true});
		expect(info.method).toBe('stream');
		expect(info.title).toBe('Audio built on the server');
		expect(info.notes.map((note) => note.id)).toEqual(['audio']);
		// A server that is transcoding anyway has already said everything.
		const transcoding = buildPlaybackInfo(answer({transcodeReasons: ['AudioCodecNotSupported']}), {audioStreamIndex: 2, audioStart});
		expect(transcoding.title).toBe('Transcoding');
		expect(transcoding.notes).toEqual([]);
	});

	it('puts the fork note for the stream count beside the reason', () => {
		const many = {...source, MediaStreams: [...source.MediaStreams, ...Array.from({length: 40}, (_, i) => ({Type: 'Subtitle', Index: 10 + i, Codec: 'subrip'}))]};
		const info = buildPlaybackInfo(answer({transcodeReasons: ['StreamCountExceedsLimit'], source: many}), {audioStreamIndex: 2, settings: {}, tizen: true});
		expect(info.reasons[0].description).toBe('The file has more streams than this TV plays in one file.');
		expect(info.notes.map((note) => note.id)).toEqual(['streams']);
	});

	it('adds the bitrate over the limit to the reasons and to what changes', () => {
		const info = buildPlaybackInfo(answer({transcodeReasons: ['AudioCodecNotSupported'], source: overLimit}), {audioStreamIndex: 1});
		expect(info.reasons).toHaveLength(2);
		expect(info.summary).toBe('Video and audio are re-encoded.');
	});

	it('says nothing is changed for a direct play and lists no reasons', () => {
		const info = buildPlaybackInfo(answer({supportsDirectPlay: true, transcodeReasons: ['AudioCodecNotSupported']}), {audioStreamIndex: 2});
		expect(info.title).toBe('Direct Play');
		expect(info.summary).toBe('The file is sent as it is.');
		expect(info.reasons).toEqual([]);
	});

	it('names the audio as the only thing re-encoded when only audio is refused', () => {
		const info = buildPlaybackInfo(answer({transcodeReasons: ['AudioCodecNotSupported']}), {audioStreamIndex: 1});
		expect(info.title).toBe('Transcoding');
		expect(info.summary).toBe('Audio is re-encoded. Video is sent as it is.');
		expect(info.reasons).toHaveLength(1);
		expect(lines(info, 'Audio')).toEqual(['English - TrueHD - 7.1']);
	});

	it('names the video and audio when both are refused, and the bitrate against the limit', () => {
		const info = buildPlaybackInfo(answer({transcodeReasons: ['VideoCodecNotSupported', 'AudioChannelsNotSupported'], source: overLimit}), {audioStreamIndex: 2});
		expect(info.summary).toBe('Video and audio are re-encoded.');
		expect(lines(info, 'File Information')).toEqual(['Container: MKV', 'Bitrate: 64.0 Mbps', 'Streaming limit: 60.0 Mbps']);
		expect(lines(info, 'Audio')).toEqual(['English - AC3 - 5.1 · 640 kbps']);
	});

	it('calls a burned in subtitle video work', () => {
		const info = buildPlaybackInfo(answer({transcodeReasons: ['SubtitleCodecNotSupported']}), {audioStreamIndex: 2, subtitleStreamIndex: 3});
		expect(info.summary).toBe('Video is re-encoded. Audio is sent as it is.');
		expect(lines(info, 'Subtitle')).toEqual(['English - SRT · Burned into the video']);
	});

	it('lets the reasons override a direct stream that names audio work', () => {
		const info = buildPlaybackInfo(answer({supportsDirectStream: true, transcodeReasons: ['AudioCodecNotSupported']}), {audioStreamIndex: 1});
		expect(info.title).toBe('Direct Stream');
		expect(info.summary).toBe('Audio is re-encoded. Video is sent as it is.');
	});

	it('calls a track the server marked to be encoded burned in, whatever the reasons say', () => {
		const encoded = {...source, MediaStreams: source.MediaStreams.map((stream) => (stream.Type === 'Subtitle' ? {...stream, DeliveryMethod: 'Encode'} : stream))};
		const info = buildPlaybackInfo(answer({transcodeReasons: ['ContainerNotSupported'], source: encoded}), {audioStreamIndex: 2, subtitleStreamIndex: 3});
		expect(lines(info, 'Subtitle')).toEqual(['English - SRT · Burned into the video']);
	});

	it('is a repackage only for a direct stream, and honest when the server gave no reason', () => {
		expect(buildPlaybackInfo(answer({supportsDirectStream: true}), {}).summary)
			.toBe('Only the container changes. Video and audio are sent as they are.');
		expect(buildPlaybackInfo(answer(), {}).summary).toBe('The server did not say which parts change.');
	});

	it('shows no subtitle line detail when none is picked', () => {
		expect(lines(buildPlaybackInfo(answer({supportsDirectPlay: true}), {}), 'Subtitle')).toEqual(['Off']);
	});
});
