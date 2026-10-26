import {render, screen} from '@testing-library/react';

import {animeLabelStyle} from '../../services/animeMarkersApi';
import AnimeMarkerPills from './AnimeMarkerPills';

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

jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));
jest.mock('../../services/animeMarkersApi', () => ({animeLabelStyle: jest.fn()}));

describe('AnimeMarkerPills', () => {
	it('spells the audio out by default', () => {
		animeLabelStyle.mockReturnValue('full');
		render(<AnimeMarkerPills marker={{kind: 'Filler'}} audio="SubbedAndDubbed" />);
		expect(screen.getByText('Subbed/Dubbed')).toBeTruthy();
		expect(screen.getByText('Filler')).toBeTruthy();
	});

	it('shortens only the audio when the plugin asks for short labels', () => {
		animeLabelStyle.mockReturnValue('short');
		const {rerender} = render(<AnimeMarkerPills marker={{kind: 'Filler'}} audio="Subbed" />);
		expect(screen.getByText('Sub')).toBeTruthy();
		expect(screen.getByText('Filler')).toBeTruthy();
		rerender(<AnimeMarkerPills audio="Dubbed" />);
		expect(screen.getByText('Dub')).toBeTruthy();
		rerender(<AnimeMarkerPills audio="SubbedAndDubbed" />);
		expect(screen.getByText('Sub/Dub')).toBeTruthy();
	});
});
