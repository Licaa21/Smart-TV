import {renderHook, act} from '@testing-library/react';

import * as playback from '../../services/playback';
import useChannelKeys from './useChannelKeys';

jest.mock('../../services/playback', () => ({getNextEpisode: jest.fn()}));

const SECOND = 10000000;
const chapters = [0, 5, 34, 600].map((s) => ({startPositionTicks: s * SECOND}));

const setup = (props = {}) => {
	const calls = {
		stepChannel: jest.fn(), showControls: jest.fn(), seekToChapter: jest.fn(), noteViewerActivity: jest.fn(),
		onPlayItem: jest.fn(), onPlayNextNow: jest.fn(), onNextTrack: jest.fn(), onPrevTrack: jest.fn()
	};
	const positionRef = {current: 100 * SECOND};
	const {result} = renderHook(() => useChannelKeys({
		item: {Id: 'e2', Type: 'Episode'}, videoQueueRef: {current: null}, chapters, positionRef,
		isLiveTV: false, isAudioMode: false, ...calls, ...props
	}));
	return {press: (step) => act(() => result.current(step)), positionRef, ...calls};
};

test('live TV changes channels', () => {
	const {press, stepChannel, seekToChapter} = setup({isLiveTV: true});
	press(1);
	press(-1);
	expect(stepChannel.mock.calls).toEqual([[1], [-1]]);
	expect(seekToChapter).not.toHaveBeenCalled();
});

test('quick presses step on from where the last jump went before it lands', () => {
	const {press, seekToChapter, onPlayItem} = setup();
	press(-1);
	press(-1);
	press(-1);
	expect(seekToChapter.mock.calls.map(([ticks]) => ticks / SECOND)).toEqual([34, 5, 0]);
	expect(onPlayItem).not.toHaveBeenCalled();
});

test('a jump that has landed is stepped on from the real position', () => {
	const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
	const {press, positionRef, seekToChapter} = setup();
	press(1);
	now.mockReturnValue(9000);
	positionRef.current = 608 * SECOND;
	press(-1);
	expect(seekToChapter.mock.calls.map(([ticks]) => ticks / SECOND)).toEqual([600, 600]);
	now.mockRestore();
});

test('past the last chapter plays the next episode, before the first plays the previous one', async () => {
	const previous = {Id: 'e1'};
	playback.getNextEpisode.mockResolvedValue(previous);
	const {press, positionRef, onPlayNextNow, onPlayItem} = setup();
	positionRef.current = 700 * SECOND;
	press(1);
	expect(onPlayNextNow).toHaveBeenCalled();

	positionRef.current = 1 * SECOND;
	await act(async () => press(-1));
	expect(playback.getNextEpisode).toHaveBeenCalledWith({Id: 'e2', Type: 'Episode'}, -1);
	expect(onPlayItem).toHaveBeenCalledWith(previous);
});

test('audio moves to the next or previous track past either end', () => {
	const {press, positionRef, onNextTrack, onPrevTrack} = setup({isAudioMode: true, chapters: []});
	press(1);
	positionRef.current = 1 * SECOND;
	press(-1);
	expect(onNextTrack).toHaveBeenCalled();
	expect(onPrevTrack).toHaveBeenCalled();
});
