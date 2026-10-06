import {audioStartNeedsServer} from './audioStartPlan';

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
