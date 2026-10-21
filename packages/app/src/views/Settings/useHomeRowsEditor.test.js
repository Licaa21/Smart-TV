import {renderHook, act, waitFor} from '@testing-library/react';

// $L reaches for ilib, which a plain unit test has no way to load. Every key is its own
// English source string, so handing the string straight back is faithful enough here.
jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));
// The real settings context and the rest of settingsRows both need the framework's own React.
jest.mock('../../context/SettingsContext', () => ({DEFAULT_HOME_ROWS: require('../../utils/homeLayout').DEFAULT_HOME_ROWS}));
jest.mock('./settingsRows', () => ({editedListKey: (items) => JSON.stringify(items)}));

import useHomeRowsEditor from './useHomeRowsEditor';

test('reopening keeps the plugin sections switched on as they were saved', async () => {
	const api = {
		getGenres: jest.fn().mockResolvedValue({Items: [{Id: 'g1', Name: 'Action'}, {Id: 'g2', Name: 'Drama'}]}),
		getLiveTvChannels: jest.fn().mockResolvedValue({Items: []})
	};
	const settings = {
		displayGenresRows: true,
		pluginSections: [{id: 'genre:g1', name: 'Action', enabled: true, order: 0, source: 'genres'}]
	};
	const {result} = renderHook(() => useHomeRowsEditor({api, settings, updateSetting: jest.fn(), updateSettings: jest.fn(), pushView: jest.fn()}));

	act(() => result.current.openHomeRows());

	await waitFor(() => expect(result.current.tempPluginSections).toHaveLength(2));
	expect(result.current.tempPluginSections.find((section) => section.id === 'genre:g1').enabled).toBe(true);
	expect(result.current.tempPluginSections.find((section) => section.id === 'genre:g2').enabled).toBe(false);
});

// The editor looks up collections and genres in the background as it opens, so let that settle
const openWith = async (homeRows, pluginSections = [], channels = [{Id: 'channel'}]) => {
	const settings = {homeRows, pluginSections};
	const api = {getLiveTvChannels: jest.fn().mockResolvedValue({Items: channels})};
	const {result} = renderHook(() => useHomeRowsEditor({api, settings, updateSetting: jest.fn(), updateSettings: jest.fn(), pushView: jest.fn()}));
	act(() => result.current.openHomeRows());
	await act(() => Promise.resolve());
	return result;
};

const rows = (...specs) => specs.map(([id, enabled], order) => ({id, name: id, enabled, order}));
const enabledIds = (list) => list.filter((row) => row.enabled).map((row) => row.id);

test('switching a row on puts it at the bottom of the enabled rows', async () => {
	const result = await openWith(rows(['resume', true], ['livetv', false], ['nextup', true], ['rewatch', false]));

	act(() => result.current.toggleHomeRow('livetv'));

	expect(enabledIds(result.current.tempHomeRows)).toEqual(['resume', 'nextup', 'livetv']);
});

test('a move passes the next enabled row and skips the disabled ones between', async () => {
	const result = await openWith(rows(['resume', true], ['livetv', false], ['nextup', true]));

	act(() => result.current.moveHomeRow('resume', 1));

	expect(enabledIds(result.current.tempHomeRows)).toEqual(['nextup', 'resume']);
});

test('plugin sections move among the enabled ones only', async () => {
	const sections = [
		{id: 'genre:a', name: 'A', enabled: true, order: 0, source: 'genres'},
		{id: 'genre:b', name: 'B', enabled: false, order: 1, source: 'genres'},
		{id: 'genre:c', name: 'C', enabled: true, order: 2, source: 'genres'}
	];
	const result = await openWith(rows(['resume', true]), sections);

	act(() => result.current.movePluginSection('genre:a', 1));

	expect(enabledIds(result.current.tempPluginSections)).toEqual(['genre:c', 'genre:a']);
});

test('a server without Live TV channels hides the Live TV rows from moves', async () => {
	const result = await openWith(rows(['resume', true], ['livetv', true], ['nextup', true]), [], []);

	act(() => result.current.moveHomeRow('resume', 1));

	expect(result.current.serverHasLiveTv).toBe(false);
	expect(enabledIds(result.current.tempHomeRows)).toEqual(['nextup', 'livetv', 'resume']);
});
