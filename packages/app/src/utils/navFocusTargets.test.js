import Spotlight from '@enact/spotlight';

import {focusFirstContentTarget, setContentFocusHint, toggleNavigationFocus, CONTENT_FOCUS_TARGETS} from './navFocusTargets';

jest.mock('@enact/spotlight', () => ({
	focus: jest.fn(),
	setPointerMode: jest.fn(),
	move: jest.fn()
}));

const card = () => {
	const element = document.createElement('div');
	document.body.appendChild(element);
	return element;
};

beforeEach(() => {
	Spotlight.focus.mockReset();
	Spotlight.move.mockReset();
	setContentFocusHint(null);
	document.body.innerHTML = '';
});

describe('focusFirstContentTarget', () => {
	it('goes to the card focus was last on before any known container', () => {
		const element = card();
		setContentFocusHint(element);
		Spotlight.focus.mockReturnValue(true);
		focusFirstContentTarget(CONTENT_FOCUS_TARGETS, 'down');
		expect(Spotlight.focus).toHaveBeenCalledTimes(1);
		expect(Spotlight.focus).toHaveBeenCalledWith(element);
	});

	it('walks the known containers when that card is gone', () => {
		const element = card();
		setContentFocusHint(element);
		element.remove();
		Spotlight.focus.mockImplementation((target) => target === 'row-0');
		focusFirstContentTarget(CONTENT_FOCUS_TARGETS, 'down');
		expect(Spotlight.focus).not.toHaveBeenCalledWith(element);
		expect(Spotlight.focus).toHaveBeenCalledWith('row-0');
	});
});

describe('toggleNavigationFocus', () => {
	it('enters the navigation from the content', () => {
		Spotlight.focus.mockImplementation((target) => target === 'navbar-home');
		expect(toggleNavigationFocus('left')).toBe(true);
		expect(Spotlight.focus).toHaveBeenCalledWith('navbar-home');
	});

	it('goes back to the content from the navigation', () => {
		const nav = document.createElement('div');
		nav.setAttribute('data-spotlight-id', 'navbar');
		const button = document.createElement('button');
		nav.appendChild(button);
		document.body.appendChild(nav);
		button.focus();
		const element = card();
		setContentFocusHint(element);
		Spotlight.focus.mockReturnValue(true);
		expect(toggleNavigationFocus('left')).toBe(true);
		expect(Spotlight.focus).toHaveBeenCalledWith(element);
	});

	it('reports when there is no navigation up', () => {
		Spotlight.focus.mockReturnValue(false);
		expect(toggleNavigationFocus('top')).toBe(false);
	});
});
