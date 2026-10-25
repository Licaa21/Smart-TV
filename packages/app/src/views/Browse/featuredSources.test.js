import {readFeaturedSources} from './featuredSources';

jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));

const titles = (source, n) => ({Items: Array.from({length: n}, (_, i) => ({Id: `${source}-${i}`, BackdropImageTags: ['b']}))});
const usable = (item) => item.BackdropImageTags?.length > 0;

describe('readFeaturedSources', () => {
	test('reads six sources at once and skips the rest once there are twice the titles the bar shows', async () => {
		const sources = Array.from({length: 20}, (_, i) => `lib${i}`);
		const fetchSource = jest.fn((id) => Promise.resolve(titles(id, 10)));
		const items = await readFeaturedSources(sources, fetchSource, usable, 5);
		expect(fetchSource).toHaveBeenCalledTimes(6);
		expect(items).toHaveLength(60);
	});

	test('counts a title two sources share once and only usable ones toward enough', async () => {
		const shared = {Items: [{Id: 'same', BackdropImageTags: ['b']}, {Id: 'bare'}]};
		const fetchSource = jest.fn(() => Promise.resolve(shared));
		const items = await readFeaturedSources(['a', 'b', 'c'], fetchSource, usable, 1);
		expect(fetchSource).toHaveBeenCalledTimes(3);
		expect(items.map((item) => item.Id)).toEqual(['same', 'bare']);
	});

	test('carries on past a source that fails', async () => {
		const fetchSource = jest.fn((id) => (id === 'bad' ? Promise.reject(new Error('403')) : Promise.resolve(titles(id, 2))));
		expect(await readFeaturedSources(['bad', 'good'], fetchSource, usable, 5)).toHaveLength(2);
	});
});
