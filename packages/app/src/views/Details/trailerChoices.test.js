jest.mock('../../platform', () => ({isTizen: jest.fn(), isVega: jest.fn(), isWebOS: jest.fn(), isXbox: jest.fn()}));
jest.mock('../../services/serverLogger', () => ({__esModule: true, default: {warn: jest.fn(), LOG_CATEGORIES: {PLAYBACK: 'Playback'}}}));
jest.mock('../../services/video', () => ({readTrailerManifest: jest.fn()}));

import {splitSubtitled, trailerChoicesFor} from './trailerChoices';

describe('the trailer choices', () => {
	it('puts the server trailers first and each YouTube video once, in order', () => {
		const choices = trailerChoicesFor(
			[{Id: 'local1', Name: 'Theatrical'}, {Name: 'no id'}],
			[
				{Url: 'https://www.youtube.com/watch?v=JtqIas3bYhg', Name: 'Official NSFW Trailer [Subtitled]'},
				{Url: 'https://example.com/trailer.mp4', Name: 'Not YouTube'},
				{Url: '', Name: 'Empty'},
				{Url: 'https://youtu.be/JtqIas3bYhg', Name: 'Same video again'},
				{Url: 'https://www.youtube.com/watch?v=x4ztgjvfU60', Name: 'Official Teaser'}
			]
		);
		expect(choices.map((c) => c.key)).toEqual(['local1', 'JtqIas3bYhg', 'x4ztgjvfU60']);
		expect(choices[0].local.Name).toBe('Theatrical');
		expect(choices[1]).toEqual({key: 'JtqIas3bYhg', title: 'Official NSFW Trailer', subtitled: true, videoId: 'JtqIas3bYhg'});
	});

	it('copes with nothing to offer', () => {
		expect(trailerChoicesFor(null, undefined)).toEqual([]);
	});

	it('turns a trailing [Subtitled] into a flag, whatever its case', () => {
		expect(splitSubtitled('Official Trailer (Studio Trigger Version) [subtitled] ')).toEqual({title: 'Official Trailer (Studio Trigger Version)', subtitled: true});
		expect(splitSubtitled('Official Teaser')).toEqual({title: 'Official Teaser', subtitled: false});
		expect(splitSubtitled('[Subtitled] first')).toEqual({title: '[Subtitled] first', subtitled: false});
		expect(splitSubtitled()).toEqual({title: '', subtitled: false});
	});
});
