import {act, render} from '@testing-library/react';

import DetailsPrefetcher from './DetailsPrefetcher';
import {setPrefetchTargets} from '../../utils/detailsPrefetchTargets';
import {detailsKey, saveDetails} from './detailsCache';

jest.mock('react/jsx-dev-runtime', () => {
	const React = require('react');
	return {Fragment: React.Fragment, jsxDEV: (type, props, key) => React.createElement(type, key === undefined ? props : {...props, key})};
});
const mockHook = jest.fn();
jest.mock('./useDetailsItem', () => (args) => { mockHook(args); return {}; });
jest.mock('./detailsStore', () => ({loadScreens: () => Promise.resolve([]), putScreen: () => Promise.resolve(), deleteScreen: () => Promise.resolve(), clearScreens: () => Promise.resolve()}));
jest.mock('../../context/AuthContext', () => ({useAuth: () => ({api: {}, serverUrl: 'http://server'})}));
jest.mock('../../context/SettingsContext', () => ({useSettings: () => ({settings: {}})}));
jest.mock('../../context/SeerrContext', () => ({useSeerr: () => ({pluginInfo: null, isEnabled: false})}));
jest.mock('../../services/connectionPool', () => ({getApiForItem: () => null}));
jest.mock('../../services/jellyfinApi', () => ({getUserId: () => 'u1'}));
jest.mock('../../services/parentalControls', () => ({getBlockedRatings: () => [], getBlockedSeriesIds: () => []}));

const movie = (id) => ({Id: id, Type: 'Movie', UserData: {}});
const loading = () => mockHook.mock.calls.map(([args]) => args).filter((args) => !args.skip).map((args) => args.itemId);

describe('the details prefetcher', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		mockHook.mockClear();
		setPrefetchTargets([movie('a'), movie('b')]);
	});
	afterEach(() => jest.useRealTimers());

	it('waits for Home to rest before it loads anything', () => {
		render(<DetailsPrefetcher />);
		expect(loading()).toEqual([]);
		act(() => jest.advanceTimersByTime(9000));
		expect(loading()).toEqual([]);
		act(() => jest.advanceTimersByTime(2000));
		expect(loading()).toContain('a');
	});

	it('stops at once when a key is pressed and starts again once it is quiet', () => {
		render(<DetailsPrefetcher />);
		act(() => jest.advanceTimersByTime(11000));
		expect(loading()).toContain('a');
		mockHook.mockClear();
		act(() => { window.dispatchEvent(new window.KeyboardEvent('keydown', {key: 'ArrowDown'})); });
		expect(mockHook.mock.calls.at(-1)[0].skip).toBe(true);
		act(() => jest.advanceTimersByTime(5000));
		expect(mockHook.mock.calls.at(-1)[0].skip).toBe(false);
	});

	it('does nothing while Home is away or the app is hidden', () => {
		render(<DetailsPrefetcher active={false} />);
		act(() => jest.advanceTimersByTime(20000));
		expect(loading()).toEqual([]);
	});

	it('goes on to the next title once one is kept', () => {
		render(<DetailsPrefetcher />);
		act(() => jest.advanceTimersByTime(11000));
		expect(loading()).toContain('a');
		mockHook.mockClear();
		act(() => {
			saveDetails(detailsKey('http://server', 'u1', 'a', {}), {item: movie('a')});
			jest.advanceTimersByTime(3000);
		});
		expect(loading()).toContain('b');
	});

	it('passes over a title that was kept a short while ago', () => {
		saveDetails(detailsKey('http://server', 'u1', 'a', {}), {item: movie('a')});
		render(<DetailsPrefetcher />);
		act(() => jest.advanceTimersByTime(11000));
		expect(loading()).not.toContain('a');
		expect(loading()).toContain('b');
	});

	it('does not start a title again and again for a viewer who keeps pressing keys', () => {
		render(<DetailsPrefetcher />);
		for (let round = 0; round < 4; round++) {
			act(() => jest.advanceTimersByTime(round === 0 ? 11000 : 5000));
			act(() => { window.dispatchEvent(new window.KeyboardEvent('keydown', {key: 'ArrowDown'})); });
		}
		act(() => jest.advanceTimersByTime(5000));
		const startsOfA = mockHook.mock.calls.filter(([args], index, all) => !args.skip && args.itemId === 'a' && (index === 0 || all[index - 1][0].skip)).length;
		expect(startsOfA).toBeLessThanOrEqual(2);
		expect(loading()).toContain('b');
	});
});
