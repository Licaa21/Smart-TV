import {pickBackdropTargets} from './detailsPrefetchTargets';

const items = (prefix, n, type = 'Episode') => Array.from({length: n}, (_, i) => ({Id: `${prefix}${i}`, Type: type}));

describe('pickBackdropTargets', () => {
	it('takes every card of Continue Watching and of Next Up, in the order Home shows them', () => {
		const rows = [{id: 'resume', items: items('r', 9)}, {id: 'latest', items: items('l', 9)}, {id: 'nextup', items: items('n', 9)}];
		expect(pickBackdropTargets(rows).map((item) => item.Id)).toEqual([...items('r', 9), ...items('n', 9)].map((item) => item.Id));
	});

	it('takes every card of the one row when the two are merged', () => {
		const rows = [{id: 'continue-nextup', items: items('c', 12)}, {id: 'resume', items: items('r', 9)}];
		expect(pickBackdropTargets(rows)).toHaveLength(12);
	});

	it('leaves out a title that is there twice, one of another server, and one of Seerr or an outside list', () => {
		const rows = [{id: 'resume', items: [{Id: 'a', Type: 'Episode'}, {Id: 'a', Type: 'Episode'}, {Id: 's', Type: 'Movie', _serverUrl: 'http://other'}, {Id: 'x', Type: 'Movie', _seerr: true}, {Id: 'e', Type: 'Movie', _external: true}, {Id: 'b', Type: 'Movie'}]}];
		expect(pickBackdropTargets(rows).map((item) => item.Id)).toEqual(['a', 'b']);
	});

	it('is empty with nothing to pick from', () => {
		expect(pickBackdropTargets(undefined)).toEqual([]);
	});
});
