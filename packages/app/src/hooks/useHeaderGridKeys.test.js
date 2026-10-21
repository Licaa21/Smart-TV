import {renderHook} from '@testing-library/react';
import Spotlight from '@enact/spotlight';

import useHeaderGridKeys from './useHeaderGridKeys';

jest.mock('@enact/spotlight', () => ({__esModule: true, default: {focus: jest.fn(() => true)}}));
jest.mock('../platform', () => ({getPlatform: () => 'tizen'}));

const press = (handler, props) => {
	const e = {preventDefault: jest.fn(), stopPropagation: jest.fn(), ...props};
	handler(e);
	return e;
};

describe('useHeaderGridKeys', () => {
	beforeEach(() => Spotlight.focus.mockClear());

	it('takes Channel Up to the header controls from anywhere and keeps the key from the rest of the app', () => {
		const {result} = renderHook(() => useHeaderGridKeys('lib-bar', 'lib-grid'));
		const e = press(result.current, {key: 'ChannelUp', keyCode: 427});
		expect(Spotlight.focus).toHaveBeenCalledWith('lib-bar');
		expect(e.preventDefault).toHaveBeenCalled();
		expect(e.stopPropagation).toHaveBeenCalled();
	});

	it('takes Channel Down back to the cards', () => {
		const {result} = renderHook(() => useHeaderGridKeys('lib-bar', 'lib-grid'));
		press(result.current, {key: 'ChannelDown', keyCode: 428});
		expect(Spotlight.focus).toHaveBeenCalledWith('lib-grid');
	});

	it('hands the cards over to the screen when it knows the card to return to', () => {
		const focusGrid = jest.fn();
		const {result} = renderHook(() => useHeaderGridKeys('lib-bar', 'lib-grid', true, focusGrid));
		press(result.current, {key: 'ChannelDown', keyCode: 428});
		expect(focusGrid).toHaveBeenCalled();
		expect(Spotlight.focus).not.toHaveBeenCalled();
	});

	it('leaves every other key alone', () => {
		const {result} = renderHook(() => useHeaderGridKeys('lib-bar', 'lib-grid'));
		const e = press(result.current, {key: 'ArrowDown', keyCode: 40});
		expect(Spotlight.focus).not.toHaveBeenCalled();
		expect(e.preventDefault).not.toHaveBeenCalled();
	});

	it('does nothing while a panel or popup is open', () => {
		const {result} = renderHook(() => useHeaderGridKeys('lib-bar', 'lib-grid', false));
		const e = press(result.current, {key: 'ChannelUp', keyCode: 427});
		expect(Spotlight.focus).not.toHaveBeenCalled();
		expect(e.preventDefault).not.toHaveBeenCalled();
	});

	it('names the header by a function when it depends on the style', () => {
		const {result} = renderHook(() => useHeaderGridKeys(() => 'lib-dock', 'lib-grid'));
		press(result.current, {key: 'ChannelUp', keyCode: 427});
		expect(Spotlight.focus).toHaveBeenCalledWith('lib-dock');
	});
});
