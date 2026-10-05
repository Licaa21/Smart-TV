import {act, fireEvent, render, screen} from '@testing-library/react';
import Search from './Search';

const mockApi = {getLibraries: jest.fn(), search: jest.fn(), searchPeople: jest.fn()};
const mockAuth = {api: mockApi, serverUrl: 'http://server', hasMultipleServers: false};
const mockSettings = {settings: {}};

jest.mock('react/jsx-dev-runtime', () => {
	const React = require('react');
	return {jsxDEV: (type, props, key, staticChildren) => {
		const config = key === undefined ? props : {...props, key};
		return staticChildren && Array.isArray(props.children)
			? React.createElement(type, config, ...props.children)
			: React.createElement(type, config);
	}};
});
jest.mock('@enact/i18n/$L', () => (text) => text);
jest.mock('@enact/spotlight', () => ({focus: jest.fn(() => true)}));
jest.mock('@enact/spotlight/Pause', () => ({isPaused: () => false}));
// Spotlight's own prop would be an unknown attribute on the plain elements these mocks render.
const plain = (type) => {
	const React = require('react');
	return ({spotlightId, ...props}) => {
		// The cards hand Spotlight its own direction handlers, which a plain element would not know.
		['onSpotlightLeft', 'onSpotlightRight', 'onSpotlightUp', 'onSpotlightDown'].forEach((name) => { delete props[name]; });
		return React.createElement(type, {...props, 'data-spotlight-id': spotlightId});
	};
};
jest.mock('@enact/spotlight/Spottable', () => (type) => plain(type));
jest.mock('@enact/spotlight/SpotlightContainerDecorator', () => (config, type) => plain(type));
jest.mock('../../context/AuthContext', () => ({useAuth: () => mockAuth}));
jest.mock('../../context/SettingsContext', () => ({useSettings: () => mockSettings}));
jest.mock('../../context/SeerrContext', () => ({useSeerr: () => ({isEnabled: false})}));
jest.mock('../../services/connectionPool', () => ({}));
jest.mock('../../services/serverLogger', () => ({__esModule: true, default: {info: jest.fn(), LOG_CATEGORIES: {APP: 'Application'}}}));
jest.mock('../../services/gamesApi', () => ({}));
jest.mock('../../services/parentalControls', () => ({withoutBlockedItems: (items) => items}));
jest.mock('../../hooks/useStorage', () => () => [[], jest.fn()]);
jest.mock('../../hooks/useItemMenuHold', () => () => ({}));
jest.mock('../../components/DetailsTabBar', () => () => null);
jest.mock('../../components/LoadingSpinner', () => () => null);
jest.mock('../../components/ProxiedImage', () => () => null);
jest.mock('../../components/GameCard', () => () => null);
jest.mock('../../components/SpottableInput/SpottableInput', () => {
	const React = require('react');
	return React.forwardRef(({value, onChange}, ref) => React.createElement('input', {ref, value, onChange}));
});

// A title shows twice on a Home card, as the caption and as the artwork's own placeholder.
const shown = (text) => screen.queryAllByText(text).length > 0;

const movie = {Id: 'm1', Type: 'Movie', Name: 'Alien'};
const person = {Id: 'p1', Type: 'Person', Name: 'Sigourney Weaver'};

// Holds the people answer until the test lets it go.
const pendingPeople = () => {
	let settle;
	mockApi.searchPeople.mockImplementation(() => new Promise((resolve, reject) => { settle = {resolve, reject}; }));
	return () => settle;
};

const typeQuery = async (text) => {
	fireEvent.change(screen.getByRole('textbox'), {target: {value: text}});
	await act(async () => { jest.advanceTimersByTime(450); });
};

beforeEach(() => {
	jest.useFakeTimers();
	jest.clearAllMocks();
	mockApi.getLibraries.mockResolvedValue([]);
	mockApi.search.mockResolvedValue({Items: [movie]});
	mockApi.searchPeople.mockResolvedValue({Items: []});
});
afterEach(() => jest.useRealTimers());

test('shows the other results after the grace and fills People in when they land', async () => {
	const people = pendingPeople();
	render(<Search />);
	await typeQuery('alien');
	expect(shown('Alien')).toBe(false);
	await act(async () => { jest.advanceTimersByTime(1000); });
	expect(shown('Alien')).toBe(true);
	expect(shown('Sigourney Weaver')).toBe(false);
	await act(async () => { people().resolve({Items: [person]}); });
	expect(shown('Alien')).toBe(true);
	expect(shown('Sigourney Weaver')).toBe(true);
});

test('people that answer inside the grace come up with everything else', async () => {
	mockApi.searchPeople.mockResolvedValue({Items: [person]});
	render(<Search />);
	await typeQuery('alien');
	expect(shown('Alien')).toBe(true);
	expect(shown('Sigourney Weaver')).toBe(true);
});

test('a failed people search leaves the other results alone', async () => {
	const people = pendingPeople();
	render(<Search />);
	await typeQuery('alien');
	await act(async () => { jest.advanceTimersByTime(1000); });
	await act(async () => { people().reject(new Error('timeout')); });
	expect(shown('Alien')).toBe(true);
	expect(shown('No results found')).toBe(false);
});

test('with nothing else found the screen waits for people', async () => {
	mockApi.search.mockResolvedValue({Items: []});
	const people = pendingPeople();
	render(<Search />);
	await typeQuery('weaver');
	await act(async () => { jest.advanceTimersByTime(3000); });
	expect(shown('No results found')).toBe(false);
	await act(async () => { people().resolve({Items: [person]}); });
	expect(shown('Sigourney Weaver')).toBe(true);
});

test('people that answer late only fill in their own search', async () => {
	const people = pendingPeople();
	render(<Search />);
	await typeQuery('alien');
	await act(async () => { jest.advanceTimersByTime(1000); });
	const firstPeople = people();
	mockApi.search.mockResolvedValue({Items: [{Id: 'm2', Type: 'Movie', Name: 'Aliens'}]});
	mockApi.searchPeople.mockResolvedValue({Items: []});
	await typeQuery('aliens');
	await act(async () => { firstPeople.resolve({Items: [person]}); });
	expect(shown('Aliens')).toBe(true);
	expect(shown('Sigourney Weaver')).toBe(false);
});
