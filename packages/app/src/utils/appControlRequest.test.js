import {makeDeepLinkGate, readRequestedDeepLink} from './appControlRequest';

const tizenWith = (values) => ({
	application: {
		getCurrentApplication: () => ({
			getRequestedAppControl: () => ({appControl: {data: [{key: 'PAYLOAD', value: [JSON.stringify({values: JSON.stringify(values)})]}]}})
		})
	}
});

describe('readRequestedDeepLink', () => {
	it('reads the title a Smart Hub tile asks for', () => {
		const found = readRequestedDeepLink(tizenWith({serverid: 's1', id: 'e1', type: 'episode', seasonid: 'se1', seriesid: 'sr1'}));
		expect(found.detail).toEqual({id: 'e1', type: 'episode', serverId: 's1', seasonId: 'se1', seriesId: 'sr1'});
	});

	it('ignores fields it does not know, and carries the stamp of the sender when there is one', () => {
		const found = readRequestedDeepLink(tizenWith({serverid: 's1', id: 'e1', type: 'episode', other: 'x', n: 1731558000000}));
		expect(found.detail).toEqual({id: 'e1', type: 'episode', serverId: 's1', n: '1731558000000'});
	});

	it('is null with no request, no title or no Tizen', () => {
		expect(readRequestedDeepLink(undefined)).toBeNull();
		expect(readRequestedDeepLink({application: {getCurrentApplication: () => ({getRequestedAppControl: () => null})}})).toBeNull();
		expect(readRequestedDeepLink(tizenWith({serverid: 's1'}))).toBeNull();
	});
});

describe('makeDeepLinkGate', () => {
	const detail = {id: 'e1', type: 'episode', serverId: 's1'};

	it('counts the same title reported twice within a moment as one request', () => {
		const gate = makeDeepLinkGate();
		expect(gate(detail, {now: 1000})).toBe(true);
		expect(gate(detail, {now: 1500})).toBe(false);
	});

	it('lets the same title in again later when the platform says it is a new request', () => {
		const gate = makeDeepLinkGate();
		expect(gate(detail, {now: 1000})).toBe(true);
		expect(gate(detail, {now: 9000})).toBe(true);
	});

	it('leaves the request acted on last alone when it is only looked for again', () => {
		const gate = makeDeepLinkGate();
		expect(gate(detail, {now: 1000})).toBe(true);
		expect(gate(detail, {now: 60000, onlyNew: true})).toBe(false);
		expect(gate({...detail, id: 'e2'}, {now: 61000, onlyNew: true})).toBe(true);
	});

	it('keeps the request the app started with from being taken for a new one, and still takes the platform reporting it', () => {
		const gate = makeDeepLinkGate();
		gate.markHandled(detail);
		expect(gate(detail, {now: 5000, onlyNew: true})).toBe(false);
		expect(gate(detail, {now: 5001})).toBe(true);
	});

	it('takes the same title pressed again when it carries a new stamp, even where it is only looked for again', () => {
		const gate = makeDeepLinkGate();
		const first = {...detail, n: '100'};
		gate.markHandled(first);
		expect(gate(first, {now: 60000, onlyNew: true})).toBe(false);
		expect(gate({...detail, n: '200'}, {now: 61000, onlyNew: true})).toBe(true);
		expect(gate({...detail, n: '200'}, {now: 90000, onlyNew: true})).toBe(false);
		expect(gate({...detail, n: '300'}, {now: 91000})).toBe(true);
	});

	it('does not reopen the stale request the platform keeps answering with once a newer stamped one was opened', () => {
		const gate = makeDeepLinkGate();
		gate.markHandled({...detail, n: '100'});
		expect(gate({...detail, id: 'e2', n: '200'}, {now: 1000, onlyNew: true})).toBe(true);
		expect(gate({...detail, n: '100'}, {now: 9000, onlyNew: true})).toBe(false);
	});

	it('ignores a request with no title', () => {
		expect(makeDeepLinkGate()({})).toBe(false);
	});
});
