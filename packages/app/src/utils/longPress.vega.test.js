import {renderHook} from '@testing-library/react';

jest.mock('../platform', () => ({getPlatform: () => 'vega'}));

import useLongPress from './longPress';

const MENU = 93;

describe('useLongPress on Vega', () => {
	test('the menu key does the hold action at once without a click', () => {
		const onLongPress = jest.fn();
		const onClick = jest.fn();
		const {result} = renderHook(() => useLongPress(onLongPress, onClick));
		const event = {keyCode: MENU, which: MENU, preventDefault: jest.fn()};

		result.current.onKeyDown(event);

		expect(onLongPress).toHaveBeenCalledTimes(1);
		expect(onClick).not.toHaveBeenCalled();
		expect(event.preventDefault).toHaveBeenCalled();
	});

	test('the menu key is left alone on a control with no hold action', () => {
		const {result} = renderHook(() => useLongPress(null, jest.fn()));
		const event = {keyCode: MENU, which: MENU, preventDefault: jest.fn()};

		result.current.onKeyDown(event);

		expect(event.preventDefault).not.toHaveBeenCalled();
	});
});
