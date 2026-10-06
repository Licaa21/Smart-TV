import {fireEvent, render, screen} from '@testing-library/react';

import FilterPopup, {FilterOption} from './FilterPopup';

jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));

// The CLI ships a second copy of React, so the components' JSX goes through the copy under test.
// Children written side by side arrive as an array, and are spread so React doesn't ask for keys.
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

// Spottable and the spotlight containers need the framework's own React.
jest.mock('@enact/spotlight/Spottable', () => {
	const React = require('react');
	return {__esModule: true, default: (tag) => ({spotlightId, ...props}) => React.createElement(tag, props)}; // eslint-disable-line no-unused-vars
});
jest.mock('@enact/spotlight/SpotlightContainerDecorator', () => {
	const React = require('react');
	return {__esModule: true, default: (config, tag) => ({spotlightId, ...props}) => React.createElement(tag, props)}; // eslint-disable-line no-unused-vars
});
jest.mock('@enact/spotlight', () => ({__esModule: true, default: {focus: jest.fn(() => true), setPointerMode: jest.fn(), getPointerMode: () => false}}));

const sort = {key: 'sort', title: 'Sort By', summary: 'Name', body: () => [
	<FilterOption key="a" label="Name" selected />,
	<FilterOption key="b" label="Date" />
]};
const genres = {key: 'genres', title: 'Genres', summary: '2', body: () => [
	<FilterOption key="a" multi label="Action" selected />,
	<FilterOption key="b" multi label="Drama" />
]};

describe('FilterPopup', () => {
	it('lists the groups with what each is set to and shows the options of the first', () => {
		render(<FilterPopup title="Sort & Filter" groups={[sort, genres]} onClose={jest.fn()} />);
		expect(screen.getByText('Sort & Filter')).toBeTruthy();
		expect(document.querySelectorAll('[data-group-key]').length).toBe(2);
		expect(screen.getByText('Name', {selector: '[class*="groupSummary"]'})).toBeTruthy();
		expect(screen.getByText('Date')).toBeTruthy();
		expect(screen.queryByText('Action')).toBeNull();
	});

	it('shows the options of the group that takes focus, and tells the screen it changed', () => {
		const onGroupChange = jest.fn();
		render(<FilterPopup title="Filter" groups={[sort, genres]} onClose={jest.fn()} onGroupChange={onGroupChange} />);
		fireEvent.focus(document.querySelector('[data-group-key="genres"]'));
		expect(screen.getByText('Action')).toBeTruthy();
		expect(screen.queryByText('Date')).toBeNull();
		expect(onGroupChange).toHaveBeenCalledWith('genres');
	});

	it('opens on the group it was asked to', () => {
		render(<FilterPopup title="Filter" groups={[sort, genres]} defaultGroup="genres" onClose={jest.fn()} />);
		expect(screen.getByText('Drama')).toBeTruthy();
	});

	it('closes on Done, on BACK and on a click outside, and not on a click inside', () => {
		const onClose = jest.fn();
		const {container} = render(<FilterPopup title="Filter" groups={[sort, genres]} onClose={onClose} />);
		fireEvent.click(screen.getByText('Done'));
		expect(onClose).toHaveBeenCalledTimes(1);
		fireEvent.keyDown(screen.getByText('Date'), {keyCode: 27});
		expect(onClose).toHaveBeenCalledTimes(2);
		fireEvent.click(screen.getByText('Date'));
		expect(onClose).toHaveBeenCalledTimes(2);
		fireEvent.click(container.firstChild);
		expect(onClose).toHaveBeenCalledTimes(3);
	});

	it('offers Clear Filters only while something is set', () => {
		const onClear = jest.fn();
		const {rerender} = render(<FilterPopup title="Filter" groups={[sort]} onClose={jest.fn()} onClear={onClear} />);
		expect(screen.queryByText('Clear Filters')).toBeNull();
		rerender(<FilterPopup title="Filter" groups={[sort]} onClose={jest.fn()} onClear={onClear} canClear />);
		fireEvent.click(screen.getByText('Clear Filters'));
		expect(onClear).toHaveBeenCalledTimes(1);
	});

	it('leaves out the group list when there is only one group', () => {
		render(<FilterPopup title="Sort By" groups={[sort, false, null]} onClose={jest.fn()} />);
		expect(document.querySelectorAll('[data-group-key]').length).toBe(0);
		expect(screen.getByText('Date')).toBeTruthy();
	});

	it('falls back to the first group when the open one goes', () => {
		const {rerender} = render(<FilterPopup title="Filter" groups={[sort, genres]} defaultGroup="genres" onClose={jest.fn()} />);
		rerender(<FilterPopup title="Filter" groups={[sort]} defaultGroup="genres" onClose={jest.fn()} />);
		expect(screen.getByText('Date')).toBeTruthy();
	});
});

describe('FilterOption', () => {
	it('marks a chosen option and passes its data attributes to the click handler', () => {
		const onClick = jest.fn((e) => e.currentTarget.dataset.optionKey);
		render(<FilterOption label="Rating" selected onClick={onClick} data-option-key="rating" />);
		const button = screen.getByText('Rating').closest('button');
		expect(button.getAttribute('data-selected')).toBe('true');
		fireEvent.click(button);
		expect(onClick).toHaveReturnedWith('rating');
	});

	it('draws no indicator when plain', () => {
		render(<FilterOption plain label="Clear" />);
		expect(screen.getByText('Clear').closest('button').querySelectorAll('span').length).toBe(1);
	});
});
