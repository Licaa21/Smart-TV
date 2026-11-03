import {act, fireEvent, render, screen} from '@testing-library/react';
import Search from './Search';

const mockApi = {getLibraries: jest.fn(), search: jest.fn(), searchPeople: jest.fn(), smartSearch: jest.fn()};
const mockAuth = {api: mockApi, serverUrl: 'http://server', hasMultipleServers: false};
const mockSettings = {settings: {useMoonfinPlugin: true}};
const mockSeerr = {
	isEnabled: true,
	displayName: 'Seerr',
	pluginInfo: {smartSearchEnabled: true},
	api: {search: jest.fn(), getImageUrl: () => null}
};

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
jest.mock('../../context/SeerrContext', () => ({useSeerr: () => mockSeerr}));
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

const smartAnswer = {
	Ready: true,
	Items: [{Id: 'm1', Type: 'Movie', Name: 'The Mask'}],
	Seerr: [{id: 8844, mediaType: 'movie', title: 'Jumanji'}]
};

// Long enough for the search's own debounce and the smart one.
const typeQuery = async (text) => {
	fireEvent.change(screen.getByRole('textbox'), {target: {value: text}});
	await act(async () => { jest.advanceTimersByTime(700); });
};

beforeEach(() => {
	jest.useFakeTimers();
	jest.clearAllMocks();
	mockSettings.settings = {useMoonfinPlugin: true};
	mockSeerr.pluginInfo = {smartSearchEnabled: true};
	mockApi.getLibraries.mockResolvedValue([]);
	mockApi.search.mockResolvedValue({Items: [{Id: 'a1', Type: 'Movie', Name: 'Aliens'}]});
	mockApi.searchPeople.mockResolvedValue({Items: []});
	mockApi.smartSearch.mockResolvedValue(smartAnswer);
	mockSeerr.api.search.mockResolvedValue({results: []});
});
afterEach(() => jest.useRealTimers());

test('a query of two words or more adds the smart rows above the usual ones', async () => {
	render(<Search />);
	await typeQuery('jim carey mask');
	expect(mockApi.smartSearch).toHaveBeenCalledWith('jim carey mask', 20, true);
	expect(screen.getByText('Smart Search (1)')).toBeTruthy();
	expect(screen.getByText('Smart Search on Seerr (1)')).toBeTruthy();
	expect(shown('The Mask')).toBe(true);
	expect(shown('Jumanji')).toBe(true);
	// the usual rows are still there, below: Search only draws the cards of the rows near focus, so below is a title for now
	const titles = screen.getAllByRole('heading').map((h) => h.textContent);
	const usual = titles.findIndex((t) => /Movies/.test(t));
	expect(usual).toBeGreaterThan(titles.indexOf('Smart Search on Seerr (1)'));
	expect(titles.indexOf('Smart Search (1)')).toBeLessThan(titles.indexOf('Smart Search on Seerr (1)'));
});

test('one word is a title or a name, so it never goes to the plugin', async () => {
	render(<Search />);
	await typeQuery('mask');
	expect(mockApi.smartSearch).not.toHaveBeenCalled();
	expect(screen.queryByText('Smart Search (1)')).toBeNull();
});

test('a studio search does not either', async () => {
	render(<Search />);
	await typeQuery('studio: new line');
	expect(mockApi.smartSearch).not.toHaveBeenCalled();
});

test('it stays off while the plugin is off, the plugin does not offer it, or the viewer turned the plugin off', async () => {
	mockSeerr.pluginInfo = {smartSearchEnabled: false};
	const {unmount} = render(<Search />);
	await typeQuery('jim carey mask');
	expect(mockApi.smartSearch).not.toHaveBeenCalled();
	unmount();

	mockSeerr.pluginInfo = {smartSearchEnabled: true};
	mockSettings.settings = {useMoonfinPlugin: false};
	render(<Search />);
	await typeQuery('jim carey mask');
	expect(mockApi.smartSearch).not.toHaveBeenCalled();
});

test('an index that is still building adds nothing, and the usual results stay', async () => {
	mockApi.smartSearch.mockResolvedValue({Ready: false, Items: [], Seerr: []});
	render(<Search />);
	await typeQuery('jim carey mask');
	expect(screen.queryByText('Smart Search (1)')).toBeNull();
	expect(shown('Aliens')).toBe(true);
});

test('a plugin that fails adds nothing and leaves the screen alone', async () => {
	mockApi.smartSearch.mockRejectedValue(new Error('500'));
	render(<Search />);
	await typeQuery('jim carey mask');
	expect(screen.queryByText('Smart Search (1)')).toBeNull();
	expect(shown('Aliens')).toBe(true);
});

test('an answer for an older query is dropped', async () => {
	let settleOld;
	mockApi.smartSearch.mockImplementationOnce(() => new Promise((resolve) => { settleOld = resolve; }));
	render(<Search />);
	await typeQuery('jim carey');
	mockApi.smartSearch.mockResolvedValueOnce({Ready: true, Items: [{Id: 'm2', Type: 'Movie', Name: 'Liar Liar'}], Seerr: []});
	await typeQuery('jim carey lawyer');
	await act(async () => { settleOld(smartAnswer); });
	expect(shown('Liar Liar')).toBe(true);
	expect(shown('The Mask')).toBe(false);
});

test('clearing the search takes the smart rows away', async () => {
	render(<Search />);
	await typeQuery('jim carey mask');
	expect(shown('The Mask')).toBe(true);
	await typeQuery('');
	expect(shown('The Mask')).toBe(false);
});

test('a Seerr title of the smart row opens the way the other Seerr results do', async () => {
	const onSelectSeerrItem = jest.fn();
	render(<Search onSelectSeerrItem={onSelectSeerrItem} />);
	await typeQuery('jim carey mask');
	fireEvent.click(screen.getAllByText('Jumanji')[0]);
	expect(onSelectSeerrItem).toHaveBeenCalledWith(expect.objectContaining({id: 8844, mediaType: 'movie'}));
});

test('clearing the search before the smart search has started stops it from coming back', async () => {
	render(<Search />);
	fireEvent.change(screen.getByRole('textbox'), {target: {value: 'jim carey mask'}});
	await act(async () => { jest.advanceTimersByTime(450); });
	fireEvent.click(screen.getByText('×'));
	await act(async () => { jest.advanceTimersByTime(1000); });
	expect(mockApi.smartSearch).not.toHaveBeenCalled();
	expect(shown('The Mask')).toBe(false);
});

// The plugin's answer with the tuning flag on, as the installed plugin sends it.
const scored = {
	Ready: true,
	Items: [
		{Card: {Id: 'd1', Type: 'Movie', Name: 'Dog Days'}, Score: 0.83, Similarity: 0.584},
		{Card: {Id: 'd2', Type: 'Movie', Name: 'Dog Days Two'}, Score: 0.73, Similarity: 0.506},
		{Card: {Id: 'x1', Type: 'Movie', Name: 'Oppenheimer'}, Score: 0.6, Similarity: 0.322},
		{Card: {Id: 'x2', Type: 'Movie', Name: 'Drive'}, Score: 0.55, Similarity: 0.372}
	],
	Seerr: [
		{id: 1, mediaType: 'movie', title: 'Hachi', score: 0.85, similarity: 0.641},
		{id: 2, mediaType: 'movie', title: 'Splice', score: 0.7, similarity: 0.35}
	]
};

test('what is not close to the best of its row is left out, library and Seerr each on its own', async () => {
	mockApi.smartSearch.mockResolvedValue(scored);
	render(<Search />);
	await typeQuery('movie about a dog');
	expect(shown('Dog Days')).toBe(true);
	expect(shown('Dog Days Two')).toBe(true);
	expect(shown('Oppenheimer')).toBe(false);
	expect(shown('Drive')).toBe(false);
	expect(shown('Hachi')).toBe(true);
	expect(shown('Splice')).toBe(false);
	expect(screen.getByText('Smart Search (2)')).toBeTruthy();
	expect(screen.getByText('Smart Search on Seerr (1)')).toBeTruthy();
});

test('a row whose results are all weak is not shown at all', async () => {
	mockApi.smartSearch.mockResolvedValue({Ready: true, Items: scored.Items.map((item) => ({...item, Similarity: 0.3})), Seerr: []});
	render(<Search />);
	await typeQuery('movie about a dog');
	expect(screen.queryByText(/Smart Search \(/)).toBeNull();
});

test('a plugin that sends no score gets everything shown, as before', async () => {
	render(<Search />);
	await typeQuery('jim carey mask');
	expect(shown('The Mask')).toBe(true);
	expect(shown('Jumanji')).toBe(true);
});
