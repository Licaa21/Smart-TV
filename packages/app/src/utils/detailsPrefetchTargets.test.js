import {getPrefetchTargets, onPrefetchTargets, pickPrefetchTargets, setPrefetchTargets} from './detailsPrefetchTargets';

const items = (prefix, n, type = 'Episode') => Array.from({length: n}, (_, i) => ({Id: `${prefix}${i}`, Type: type}));

describe('pickPrefetchTargets', () => {
	it('takes the first six of Continue Watching and of Next Up', () => {
		const rows = [{id: 'resume', items: items('r', 9)}, {id: 'latest', items: items('l', 9)}, {id: 'nextup', items: items('n', 9)}];
		expect(pickPrefetchTargets(rows).map((item) => item.Id)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'n0', 'n1', 'n2', 'n3', 'n4', 'n5']);
	});

	it('takes the first six of the one row when the two are merged', () => {
		const rows = [{id: 'continue-nextup', items: items('c', 9)}, {id: 'resume', items: items('r', 9)}];
		expect(pickPrefetchTargets(rows).map((item) => item.Id)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', 'c5']);
	});

	it('leaves out what has no screen to keep and what is there twice', () => {
		const rows = [{id: 'resume', items: [{Id: 'a', Type: 'Episode'}, {Id: 'b', Type: 'BoxSet'}, {Type: 'Movie'}, {Id: 'a', Type: 'Episode'}]}, {id: 'nextup', items: [{Id: 'a', Type: 'Episode'}, {Id: 'c', Type: 'Movie'}]}];
		expect(pickPrefetchTargets(rows).map((item) => item.Id)).toEqual(['a', 'c']);
	});

	it('is empty with nothing to pick from', () => {
		expect(pickPrefetchTargets(undefined)).toEqual([]);
		expect(pickPrefetchTargets([{id: 'latest', items: items('l', 3)}])).toEqual([]);
	});
});

describe('the targets Home publishes', () => {
	it('tell a listener when they change and not when they do not', () => {
		const heard = jest.fn();
		const stop = onPrefetchTargets(heard);
		setPrefetchTargets(items('x', 2));
		setPrefetchTargets(items('x', 2));
		expect(heard).toHaveBeenCalledTimes(1);
		setPrefetchTargets(items('y', 1));
		expect(heard).toHaveBeenCalledTimes(2);
		expect(getPrefetchTargets().map((item) => item.Id)).toEqual(['y0']);
		stop();
	});
});
