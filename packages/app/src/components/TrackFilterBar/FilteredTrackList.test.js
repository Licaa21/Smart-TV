import {fireEvent, render, screen} from '@testing-library/react';
import Spotlight from '@enact/spotlight';

import FilteredTrackList from './FilteredTrackList';

jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));

// The CLI ships a second copy of React, so the components' JSX goes through the copy under test.
jest.mock('react/jsx-dev-runtime', () => {
	const React = require('react');
	return {
		jsxDEV: (type, {children, ...props}, key, isStaticChildren) => {
			const config = key === undefined ? props : {...props, key};
			if (children === undefined) return React.createElement(type, config);
			return isStaticChildren ? React.createElement(type, config, ...children) : React.createElement(type, config, children);
		}
	};
});

// Spottable, the row and the field need the framework's own React and settings, so they stand in as plain elements.
jest.mock('@enact/spotlight/Spottable', () => {
	const React = require('react');
	return {__esModule: true, default: (tag) => ({spotlightId, ...props}) => React.createElement(tag, props)}; // eslint-disable-line no-unused-vars
});
jest.mock('@enact/spotlight', () => ({__esModule: true, default: {focus: jest.fn(() => true)}}));
jest.mock('../../utils/spotlightContainers', () => {
	const React = require('react');
	return {ChipRowContainer: ({spotlightId, ...props}) => React.createElement('div', props)}; // eslint-disable-line no-unused-vars
});
jest.mock('../SpottableInput/SpottableInput', () => {
	const React = require('react');
	return {__esModule: true, default: ({spotlightId, ...props}) => React.createElement('input', props)}; // eslint-disable-line no-unused-vars
});
jest.mock('../TrackOptionRow', () => {
	const React = require('react');
	const Row = ({label, detail, dimmed, spotlightId, ...props}) => React.createElement('button', {...props, 'data-dimmed': dimmed ? 'true' : undefined}, detail ? `${label} (${detail})` : label); // eslint-disable-line no-unused-vars
	return {__esModule: true, default: Row, TrackDivider: () => React.createElement('hr')};
});

const track = (n, language, name) => ({language, text: `${n} - ${name}`, label: `${n} - ${name}`});
const rowOf = (entry, i) => <button key={entry.label} data-track={i}>{entry.label}</button>;

const shortList = [track(1, 'eng', 'English'), track(2, 'ron', 'Romanian')];
const longList = [
	...Array.from({length: 9}, (_, i) => track(i + 1, 'eng', `English ${i % 2 ? 'SDH' : 'Forced'}`)),
	...Array.from({length: 4}, (_, i) => track(i + 10, 'ron', `Romanian ${i}`)),
	track(14, undefined, 'Commentary')
];

const onClick = jest.fn();
const actions = [
	{label: 'Offset', spotlightId: 'offset', onClick},
	{label: 'Cancel', dimmed: true, onClick}
];

const draw = (entries) => render(
	<FilteredTrackList
		modal="subtitle"
		listClassName="list"
		leading={<button>None</button>}
		entries={entries}
		rows={entries.map(rowOf)}
		actions={actions}
	/>
);

// A chip's number sits in its own span, so a chip is found by everything it says
const chip = (text) => screen.getAllByRole('button').find((b) => b.textContent === text);
const shown = () => screen.queryAllByRole('button').map((b) => b.textContent);

beforeEach(() => {
	jest.clearAllMocks();
	Spotlight.focus.mockReturnValue(true);
});

describe('FilteredTrackList', () => {
	it('draws a short list the way it always was, with the actions under the tracks', () => {
		draw(shortList);
		expect(shown()).toEqual(['None', '1 - English', '2 - Romanian', 'Offset', 'Cancel']);
		expect(screen.queryByPlaceholderText('Search tracks')).toBeNull();
	});

	it('puts the actions in a strip over a long list, with chips for its languages', () => {
		draw(longList);
		const labels = shown();
		expect(labels.slice(0, 5)).toEqual(['All', 'ENG9', 'RON4', 'Other1', 'Offset']);
		expect(screen.getByPlaceholderText('Search tracks')).toBeTruthy();
		expect(labels).toContain('None');
		expect(labels).toHaveLength(4 + 2 + 1 + 14);
	});

	it('keeps one language when its chip is pressed, and everything again on All', () => {
		draw(longList);
		fireEvent.click(chip('RON4'));
		expect(shown().filter((t) => /^\d+ - /.test(t))).toHaveLength(4);
		fireEvent.click(chip('Other1'));
		expect(shown().filter((t) => /^\d+ - /.test(t))).toEqual(['14 - Commentary']);
		fireEvent.click(screen.getByText('All'));
		expect(shown().filter((t) => /^\d+ - /.test(t))).toHaveLength(14);
	});

	it('narrows by what is typed, always keeping None', () => {
		draw(longList);
		fireEvent.change(screen.getByPlaceholderText('Search tracks'), {target: {value: 'forced'}});
		const tracks = shown().filter((t) => /^\d+ - /.test(t));
		expect(tracks.length).toBe(5);
		tracks.forEach((t) => expect(t).toContain('Forced'));
		expect(shown()).toContain('None');
	});

	it('runs an action from the strip', () => {
		draw(longList);
		fireEvent.click(screen.getByText('Offset'));
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('takes Channel Up to the strip and Channel Down back to the chosen track', () => {
		draw(longList);
		fireEvent.keyDown(screen.getByText('1 - English Forced'), {key: 'ChannelUp'});
		expect(Spotlight.focus).toHaveBeenLastCalledWith('track-filter-bar');
		fireEvent.keyDown(screen.getByText('Offset'), {key: 'ChannelDown'});
		expect(Spotlight.focus).toHaveBeenLastCalledWith('[data-modal="subtitle"] [data-selected="true"]');
	});

	it('falls back to the first track when the chosen one is filtered out', () => {
		Spotlight.focus.mockReturnValueOnce(false);
		draw(longList);
		fireEvent.keyDown(screen.getByText('Offset'), {key: 'ChannelDown'});
		expect(Spotlight.focus).toHaveBeenLastCalledWith('[data-modal="subtitle"] [data-index]');
	});

	describe('Up and Down in a long list', () => {
		const trackRow = (n) => screen.getByText(`${n} - English ${(n - 1) % 2 ? 'SDH' : 'Forced'}`);

		it('steps to the next track by hand, and keeps the key from Spotlight', () => {
			draw(longList);
			const stop = fireEvent.keyDown(trackRow(2), {keyCode: 40});
			expect(stop).toBe(false);
			expect(Spotlight.focus).toHaveBeenLastCalledWith(trackRow(3));
			fireEvent.keyDown(trackRow(3), {keyCode: 38});
			expect(Spotlight.focus).toHaveBeenLastCalledWith(trackRow(2));
		});

		it('goes from the first track to None, and from None to the strip', () => {
			draw(longList);
			fireEvent.keyDown(trackRow(1), {keyCode: 38});
			expect(Spotlight.focus).toHaveBeenLastCalledWith(screen.getByText('None'));
			fireEvent.keyDown(screen.getByText('None'), {keyCode: 38});
			expect(Spotlight.focus).toHaveBeenLastCalledWith('track-filter-bar');
		});

		it('stays on the last track when Down has nowhere to go', () => {
			draw(longList);
			const last = screen.getByText('14 - Commentary');
			const stop = fireEvent.keyDown(last, {keyCode: 40});
			expect(stop).toBe(false);
			expect(Spotlight.focus).not.toHaveBeenCalled();
		});

		it('only steps among the tracks the filter kept', () => {
			draw(longList);
			fireEvent.click(chip('RON4'));
			fireEvent.keyDown(screen.getByText('None'), {keyCode: 40});
			expect(Spotlight.focus).toHaveBeenLastCalledWith(screen.getByText('10 - Romanian 0'));
		});

		it('leaves Left and Right to the rows', () => {
			draw(longList);
			const stop = fireEvent.keyDown(trackRow(2), {keyCode: 39});
			expect(stop).toBe(true);
			expect(Spotlight.focus).not.toHaveBeenCalled();
		});
	});

	it('leaves the channel keys alone in a short list', () => {
		draw(shortList);
		fireEvent.keyDown(screen.getByText('1 - English'), {key: 'ChannelUp'});
		expect(Spotlight.focus).not.toHaveBeenCalled();
	});
});
