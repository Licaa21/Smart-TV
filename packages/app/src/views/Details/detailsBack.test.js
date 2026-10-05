import {renderHook} from '@testing-library/react';

import useDetailsModals from './useDetailsModals';

jest.mock('@enact/spotlight', () => ({focus: jest.fn()}));

const ref = (fn) => ({current: fn});

describe('the detail screen back handler', () => {
	it('closes a playing trailer before anything else answers', () => {
		const backHandlerRef = ref(null);
		const closeTrailer = jest.fn(() => true);
		const closeSeerr = jest.fn(() => true);
		renderHook(() => useDetailsModals({
			backHandlerRef,
			seerrBackRef: ref(closeSeerr),
			trailerBackRef: ref(closeTrailer)
		}));
		expect(backHandlerRef.current()).toBe(true);
		expect(closeTrailer).toHaveBeenCalledTimes(1);
		expect(closeSeerr).not.toHaveBeenCalled();
	});

	it('passes BACK on when no trailer is up', () => {
		const backHandlerRef = ref(null);
		renderHook(() => useDetailsModals({
			backHandlerRef,
			trailerBackRef: ref(() => false)
		}));
		expect(backHandlerRef.current()).toBe(false);
	});
});
