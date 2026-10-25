jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));

import {
	hashPin, isPinShaped, lockoutRemaining, registerFailedAttempt, clearedLockout, formatWait,
	pinMatches, KIDS_PIN, PIN_MAX_LOCKOUT_MS
} from './pinLockout';

const NOW = 1_700_000_000_000;

// The counters a sign in PIN record keeps.
const SIGN_IN_PIN = {failed: 'failed', until: 'lockedUntil'};

// Walks the given number of wrong guesses, carrying the settings along the way.
const guessWrong = (times, keys, now = NOW) => {
	let settings = {};
	let last = {wait: 0, changes: {}};
	for (let i = 0; i < times; i++) {
		last = registerFailedAttempt(settings, keys, now);
		settings = {...settings, ...last.changes};
	}
	return {settings, wait: last.wait};
};

describe('the lockout', () => {
	test('lets a few wrong guesses through without a wait', () => {
		const {settings, wait} = guessWrong(5, SIGN_IN_PIN);
		expect(wait).toBe(0);
		expect(lockoutRemaining(settings, SIGN_IN_PIN, NOW)).toBe(0);
	});

	test('makes the wait grow once the free guesses run out', () => {
		expect(guessWrong(6, SIGN_IN_PIN).wait).toBe(30_000);
		expect(guessWrong(7, SIGN_IN_PIN).wait).toBe(60_000);
		expect(guessWrong(8, SIGN_IN_PIN).wait).toBe(90_000);
	});

	test('caps the wait so a parent is never locked out for long', () => {
		expect(guessWrong(80, SIGN_IN_PIN).wait).toBe(PIN_MAX_LOCKOUT_MS);
		expect(guessWrong(500, SIGN_IN_PIN).wait).toBe(PIN_MAX_LOCKOUT_MS);
	});

	test('counts the wait down rather than holding it', () => {
		const {settings} = guessWrong(6, SIGN_IN_PIN);
		expect(lockoutRemaining(settings, SIGN_IN_PIN, NOW + 10_000)).toBe(20_000);
		expect(lockoutRemaining(settings, SIGN_IN_PIN, NOW + 30_000)).toBe(0);
		expect(lockoutRemaining(settings, SIGN_IN_PIN, NOW + 999_999)).toBe(0);
	});

	test('clearing drops a lockout that was running', () => {
		const {settings} = guessWrong(9, SIGN_IN_PIN);
		expect(lockoutRemaining(settings, SIGN_IN_PIN, NOW)).toBeGreaterThan(0);

		const cleared = {...settings, ...clearedLockout(SIGN_IN_PIN)};
		expect(lockoutRemaining(cleared, SIGN_IN_PIN, NOW)).toBe(0);
	});

	test('forgets past guesses once they are cleared', () => {
		const {settings} = guessWrong(9, SIGN_IN_PIN);
		const cleared = {...settings, ...clearedLockout(SIGN_IN_PIN)};
		expect(registerFailedAttempt(cleared, SIGN_IN_PIN, NOW).wait).toBe(0);
	});

	test('the kids PIN counts separately from the sign in one', () => {
		const {settings} = guessWrong(9, SIGN_IN_PIN);

		expect(lockoutRemaining(settings, SIGN_IN_PIN, NOW)).toBeGreaterThan(0);
		expect(lockoutRemaining(settings, KIDS_PIN, NOW)).toBe(0);
		expect(registerFailedAttempt(settings, KIDS_PIN, NOW).wait).toBe(0);

		// And clearing one leaves the other alone.
		const cleared = {...settings, ...clearedLockout(KIDS_PIN)};
		expect(lockoutRemaining(cleared, SIGN_IN_PIN, NOW)).toBeGreaterThan(0);
	});

	test('a fresh set of settings is not locked out', () => {
		expect(lockoutRemaining({}, SIGN_IN_PIN, NOW)).toBe(0);
		expect(lockoutRemaining(undefined, SIGN_IN_PIN, NOW)).toBe(0);
	});
});

describe('formatWait', () => {
	test('reads as seconds under a minute and whole minutes above', () => {
		expect(formatWait(0)).toBe('0s');
		expect(formatWait(30_000)).toBe('30s');
		expect(formatWait(59_999)).toBe('59s');
		expect(formatWait(60_000)).toBe('1m');
		expect(formatWait(90_000)).toBe('1m');
		expect(formatWait(PIN_MAX_LOCKOUT_MS)).toBe('15m');
	});
});

describe('pinMatches', () => {
	test('takes the right PIN against a stored hash', () => {
		const hash = hashPin('1357');
		expect(pinMatches('1357', {hash})).toBe(true);
		expect(pinMatches('7531', {hash})).toBe(false);
	});

	// A PIN saved before this client started hashing is still stored as itself.
	test('still takes a PIN that was stored before hashing', () => {
		expect(pinMatches('1357', {plain: '1357'})).toBe(true);
		expect(pinMatches('7531', {plain: '1357'})).toBe(false);
	});

	test('the hash wins once there is one, so a stale plain PIN cannot reopen it', () => {
		expect(pinMatches('9999', {hash: hashPin('1357'), plain: '9999'})).toBe(false);
	});

	test('a PIN that was never set verifies nothing', () => {
		expect(pinMatches('0000', {})).toBe(false);
		expect(pinMatches('0000', {hash: '', plain: ''})).toBe(false);
		expect(pinMatches('', {plain: '1357'})).toBe(false);
	});

	test('only four digits are a PIN at all', () => {
		expect(isPinShaped('1234')).toBe(true);
		expect(isPinShaped('123')).toBe(false);
		expect(isPinShaped('12345')).toBe(false);
		expect(isPinShaped('12a4')).toBe(false);
		expect(pinMatches('12a4', {plain: '12a4'})).toBe(false);
	});
});
