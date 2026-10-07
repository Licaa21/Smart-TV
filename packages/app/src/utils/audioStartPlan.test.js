import {audioStartNeedsServer, openingAudioStream} from './audioStartPlan';

const streams = [{index: 4, codec: 'flac'}, {index: 5, codec: 'truehd'}, {index: 6, codec: 'ac3'}];

describe('audioStartNeedsServer', () => {
	test('asks the server for a pick that is not the first track', () => {
		expect(audioStartNeedsServer({wanted: streams[2], audioStreams: streams})).toBe(true);
		expect(audioStartNeedsServer({wanted: streams[1], audioStreams: streams})).toBe(true);
	});

	test('leaves a pick that is the first track to the player', () => {
		expect(audioStartNeedsServer({wanted: streams[0], audioStreams: streams})).toBe(false);
	});

	test('leaves live TV, Force Direct Play and a missing pick or track list alone', () => {
		expect(audioStartNeedsServer({wanted: streams[2], audioStreams: streams, isLiveTV: true})).toBe(false);
		expect(audioStartNeedsServer({wanted: streams[2], audioStreams: streams, forceDirectPlay: true})).toBe(false);
		expect(audioStartNeedsServer({wanted: null, audioStreams: streams})).toBe(false);
		expect(audioStartNeedsServer({wanted: streams[2], audioStreams: []})).toBe(false);
		expect(audioStartNeedsServer({wanted: streams[2]})).toBe(false);
	});
});

describe('the track the set opens on', () => {
	// AVPlay leaves TrueHD out of its list, so a file that starts on it opens on the next track
	const truehdFirst = [{index: 5, codec: 'truehd'}, {index: 6, codec: 'ac3'}, {index: 7, codec: 'ac3'}];
	const canDecode = (stream) => stream.codec !== 'truehd';

	test('is the first track the set decodes, not the first in the file', () => {
		expect(openingAudioStream(truehdFirst, canDecode).index).toBe(6);
		expect(openingAudioStream(truehdFirst).index).toBe(5);
		expect(openingAudioStream([{index: 5, codec: 'truehd'}], canDecode).index).toBe(5);
		expect(openingAudioStream([], canDecode)).toBeNull();
	});

	test('a pick in the codec it opens on is left to the player', () => {
		expect(audioStartNeedsServer({wanted: truehdFirst[2], audioStreams: truehdFirst, canDecode, allowSameCodec: true})).toBe(false);
		expect(audioStartNeedsServer({wanted: truehdFirst[1], audioStreams: truehdFirst, canDecode, allowSameCodec: true})).toBe(false);
		// a reload has no native switch queued, so it builds the track
		expect(audioStartNeedsServer({wanted: truehdFirst[2], audioStreams: truehdFirst, canDecode})).toBe(true);
	});

	test('a pick in another codec is built on the server', () => {
		const flacFirst = [{index: 4, codec: 'flac'}, {index: 6, codec: 'ac3'}];
		expect(audioStartNeedsServer({wanted: flacFirst[1], audioStreams: flacFirst, canDecode, allowSameCodec: true})).toBe(true);
	});

	test('a pick the set cannot decode is built on the server', () => {
		expect(audioStartNeedsServer({wanted: truehdFirst[0], audioStreams: truehdFirst, canDecode, allowSameCodec: true})).toBe(true);
	});

	test('the server and player shapes of a stream read the same', () => {
		const serverShape = [{Index: 4, Codec: 'FLAC'}, {Index: 6, Codec: 'AC3'}];
		expect(audioStartNeedsServer({wanted: serverShape[1], audioStreams: serverShape, allowSameCodec: true})).toBe(true);
		expect(audioStartNeedsServer({wanted: serverShape[0], audioStreams: serverShape})).toBe(false);
	});
});

