import {render} from '@testing-library/react';
import {LibraryDock, ModernBar, libraryStyleOf} from './LibraryHeaders';

// The CLI ships a second copy of React, so the components' JSX goes through the copy under test.
jest.mock('react/jsx-dev-runtime', () => {
	const React = require('react');
	return {
		Fragment: React.Fragment,
		jsxDEV: (type, {children, ...props}, key, isStaticChildren) => {
			const config = key === undefined ? props : {...props, key};
			if (children === undefined) return React.createElement(type, config);
			return isStaticChildren ? React.createElement(type, config, ...children) : React.createElement(type, config, children);
		}
	};
});
jest.mock('@enact/i18n/$L', () => (text) => text);
// Spotlight's own props would be unknown attributes on the plain elements these mocks render.
function mockPlain (type) {
	const React = require('react');
	return (props) => {
		const rest = {...props, 'data-spotlight-id': props.spotlightId};
		['spotlightId', 'onSpotlightLeft', 'onSpotlightRight'].forEach((key) => delete rest[key]);
		return React.createElement(type, rest);
	};
}
jest.mock('@enact/spotlight/Spottable', () => (type) => mockPlain(type));
jest.mock('@enact/spotlight/SpotlightContainerDecorator', () => (config, type) => mockPlain(type));
jest.mock('../../components/SpottableInput/SpottableInput', () => (props) => mockPlain('input')(props));

const has = (id) => document.querySelector(`[data-spotlight-id="${id}"]`) !== null;
const sortOnly = {sortLabel: 'Popularity', sortAscending: false, onSort: () => {}};

describe('the library headers on a screen with only a sort control', () => {
	it('draws the Modern bar with the sort pill alone', () => {
		render(<ModernBar {...sortOnly} />);
		expect(has('library-sort-btn')).toBe(true);
		['library-home-btn', 'library-search', 'library-show-btn', 'library-settings-btn', 'library-group-btn'].forEach((id) => expect(has(id)).toBe(false));
	});

	it('draws the Docked panel with the title and the sort row alone', () => {
		const {container} = render(<LibraryDock {...sortOnly} isFolderView={false} folderStack={[]} displayName="Action" shownCount={20} />);
		expect(has('library-sort-btn')).toBe(true);
		['library-home-btn', 'library-search', 'library-show-btn', 'library-settings-btn'].forEach((id) => expect(has(id)).toBe(false));
		expect(container.textContent).toContain('Action');
		expect(container.textContent).toContain('20');
	});

	it('keeps every control for the library itself', () => {
		const noop = () => {};
		render(<ModernBar canGroup sortLabel="Name" sortAscending searchQuery="" onSearchChange={noop} onHome={noop} onSort={noop} onGroup={noop} onShow={noop} onSettings={noop} groupLabel="None" showLabel="All" />);
		['library-home-btn', 'library-sort-btn', 'library-group-btn', 'library-show-btn', 'library-settings-btn'].forEach((id) => expect(has(id)).toBe(true));
	});
});

describe('libraryStyleOf', () => {
	it('knows the three styles and reads anything else as Classic', () => {
		expect(libraryStyleOf({libraryStyle: 'modern'})).toBe('modern');
		expect(libraryStyleOf({libraryStyle: 'docked'})).toBe('docked');
		expect(libraryStyleOf({libraryStyle: 'classic'})).toBe('classic');
		expect(libraryStyleOf({libraryStyle: 'tiles'})).toBe('classic');
		expect(libraryStyleOf({})).toBe('classic');
	});
});
