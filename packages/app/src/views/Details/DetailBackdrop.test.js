import {render, screen} from '@testing-library/react';

import DetailBackdrop from './DetailBackdrop';
import {artSource} from '../../components/MediaCard/artPrefetch';

jest.mock('react/jsx-dev-runtime', () => {
	const React = require('react');
	return {Fragment: React.Fragment, jsxDEV: (type, props, key, staticChildren) => {
		const config = key === undefined ? props : {...props, key};
		return staticChildren && Array.isArray(props.children) ? React.createElement(type, config, ...props.children) : React.createElement(type, config);
	}};
});
jest.mock('../../context/SettingsContext', () => ({useSettings: () => ({activeTheme: {id: 'glass'}})}));
jest.mock('../../utils/scrimImage', () => ({scrimStyle: () => ({})}));
jest.mock('../../components/MediaCard/artPrefetch', () => ({artSource: jest.fn(() => null), pinArt: jest.fn()}));

const URL_OF = 'http://server/Items/m1/Images/Backdrop?maxWidth=1920&quality=90';

describe('the picture behind a details screen', () => {
	beforeEach(() => {
		artSource.mockReset();
		artSource.mockReturnValue(null);
	});

	it('draws the copy that was read ahead, which is in memory already', () => {
		artSource.mockReturnValue('blob:held-backdrop');
		render(<DetailBackdrop backdropUrl={URL_OF} blur={0} />);
		expect(screen.getByRole('presentation').getAttribute('src')).toBe('blob:held-backdrop');
		expect(artSource).toHaveBeenCalledWith(URL_OF);
	});

	it('asks the server for it as before when no copy was read ahead', () => {
		render(<DetailBackdrop backdropUrl={URL_OF} blur={0} />);
		expect(screen.getByRole('presentation').getAttribute('src')).toBe(URL_OF);
	});

	it('draws nothing for a title with no backdrop', () => {
		render(<DetailBackdrop backdropUrl={null} blur={0} />);
		expect(screen.queryByRole('presentation')).toBeNull();
	});
});
