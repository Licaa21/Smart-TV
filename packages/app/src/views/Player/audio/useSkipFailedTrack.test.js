import {renderHook} from '@testing-library/react';

import useSkipFailedTrack from './useSkipFailedTrack';

const setup = (props) => {
	const handleNextTrack = jest.fn();
	const handleBack = jest.fn();
	const {rerender} = renderHook((p) => useSkipFailedTrack({handleNextTrack, handleBack, ...p}), {
		initialProps: {error: null, background: true, item: {Id: 'a'}, hasNextTrack: true, ...props}
	});
	return {rerender, handleNextTrack, handleBack};
};

describe('useSkipFailedTrack', () => {
	test('a failed track in the background moves on to the next one, once', () => {
		const {rerender, handleNextTrack, handleBack} = setup();
		rerender({error: 'failed', background: true, item: {Id: 'a'}, hasNextTrack: true});
		rerender({error: 'failed', background: true, item: {Id: 'a'}, hasNextTrack: true});
		expect(handleNextTrack).toHaveBeenCalledTimes(1);
		expect(handleBack).not.toHaveBeenCalled();
	});

	test('the same track failing again stops the music', () => {
		const {rerender, handleNextTrack, handleBack} = setup();
		rerender({error: 'failed', background: true, item: {Id: 'a'}, hasNextTrack: true});
		rerender({error: null, background: true, item: {Id: 'a'}, hasNextTrack: true});
		rerender({error: 'failed', background: true, item: {Id: 'a'}, hasNextTrack: true});
		expect(handleNextTrack).toHaveBeenCalledTimes(1);
		expect(handleBack).toHaveBeenCalledTimes(1);
	});

	test('the last track failing stops the music', () => {
		const {rerender, handleNextTrack, handleBack} = setup({hasNextTrack: false});
		rerender({error: 'failed', background: true, item: {Id: 'a'}, hasNextTrack: false});
		expect(handleNextTrack).not.toHaveBeenCalled();
		expect(handleBack).toHaveBeenCalledTimes(1);
	});

	test('an error on screen is left for the viewer until the music goes behind the screens', () => {
		const {rerender, handleNextTrack} = setup({background: false});
		rerender({error: 'failed', background: false, item: {Id: 'a'}, hasNextTrack: true});
		expect(handleNextTrack).not.toHaveBeenCalled();
		rerender({error: 'failed', background: true, item: {Id: 'a'}, hasNextTrack: true});
		expect(handleNextTrack).toHaveBeenCalledTimes(1);
	});
});
