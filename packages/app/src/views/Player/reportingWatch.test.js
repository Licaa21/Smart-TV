import {AFTER_RELOAD_MS, HEAL_EVERY_MS, QUIET_MS, watchReporting} from './reportingWatch';

const healthy = {hasSession: true, progressActive: true, sinceOkMs: 4000, failures: 0};
const look = (over = {}) => watchReporting({
	state: healthy,
	now: 10 * 60 * 1000,
	noSessionChecks: 0,
	healedAt: 0,
	loggedAt: 0,
	reloadedAt: 0,
	reloadedHere: false,
	...over
});

describe('the reporting watch', () => {
	test('leaves a healthy session alone, and writes nothing', () => {
		expect(look()).toEqual({heal: false, log: null});
	});

	test('starts the reports again when the picture plays and they are not running', () => {
		const result = look({state: {...healthy, progressActive: false}});
		expect(result.heal).toBe(true);
		expect(result.log.level).toBe('error');
	});

	test('does that once a minute at most, so it cannot become a loop', () => {
		const now = 10 * 60 * 1000;
		const off = {...healthy, progressActive: false};
		expect(look({state: off, now, healedAt: now - HEAL_EVERY_MS + 1}).heal).toBe(false);
		expect(look({state: off, now, healedAt: now - HEAL_EVERY_MS}).heal).toBe(true);
	});

	test('says when the server has taken nothing for a while, and only every five minutes', () => {
		const quiet = {...healthy, sinceOkMs: QUIET_MS + 1};
		const first = look({state: quiet});
		expect(first).toMatchObject({heal: false, log: {level: 'error', message: expect.stringContaining('has not taken a progress report')}});
		const now = 10 * 60 * 1000;
		expect(look({state: quiet, now, faultLoggedAt: now - 60 * 1000}).log).toBeNull();
		expect(look({state: quiet, now, faultLoggedAt: now - 5 * 60 * 1000}).log).not.toBeNull();
	});

	test('does not call a session quiet that began a moment ago', () => {
		expect(look({state: {...healthy, sinceOkMs: 2000}}).log).toBeNull();
	});

	test('says there is no session only after two looks in a row, since the gap between episodes is not one', () => {
		const none = {hasSession: false, progressActive: false, sinceOkMs: null};
		expect(look({state: none, noSessionChecks: 1}).log).toBeNull();
		expect(look({state: none, noSessionChecks: 2}).log).toMatchObject({level: 'info', message: expect.stringContaining('no session')});
	});

	test('does not start reports that there is no session for', () => {
		const none = {hasSession: false, progressActive: false, sinceOkMs: null};
		expect(look({state: none, noSessionChecks: 5}).heal).toBe(false);
	});

	test('does not let the lines after a reload hold a fault back', () => {
		const now = 20 * 60 * 1000;
		const quiet = {...healthy, sinceOkMs: QUIET_MS + 1};
		const result = look({state: quiet, now, reloadedAt: now - 60 * 1000, reloadedHere: true, loggedAt: now - 1000});
		expect(result).toMatchObject({fault: true, log: {level: 'error'}});
	});

	test('writes a line a minute for a quarter of an hour after a reload, for the item that was reloaded', () => {
		const now = 20 * 60 * 1000;
		const reloadedAt = now - 5 * 60 * 1000;
		expect(look({now, reloadedAt, reloadedHere: true})).toMatchObject({log: {level: 'info'}});
		expect(look({now, reloadedAt, reloadedHere: true, loggedAt: now - 30 * 1000}).log).toBeNull();
		expect(look({now, reloadedAt, reloadedHere: true, loggedAt: now - 60 * 1000}).log).not.toBeNull();
		// another item, or a reload long ago, is no business of the watch
		expect(look({now, reloadedAt, reloadedHere: false}).log).toBeNull();
		expect(look({now, reloadedAt: now - AFTER_RELOAD_MS - 1, reloadedHere: true}).log).toBeNull();
	});
});
