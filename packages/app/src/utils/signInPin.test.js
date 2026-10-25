import {
	PIN_ACCEPTED, PIN_REJECTED, dropSignInPin, isSignInPinEnabled, refreshSignInPin, signInPinFor, storeSignInPin,
	verifySignInPin
} from './signInPin';
import {hashPin} from './pinLockout';
import * as serverPin from '../services/serverPinApi';

jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));
jest.mock('../services/serverPinApi', () => ({
	...jest.requireActual('../services/serverPinApi'),
	getServerPinStatus: jest.fn(),
	verifyServerPin: jest.fn(),
	setServerPin: jest.fn(),
	removeServerPin: jest.fn()
}));

const account = {serverUrl: 'http://server', accessToken: 'token', serverType: 'jellyfin'};
const local = {enabled: true, hash: hashPin('1234'), failed: 0, lockedUntil: 0, server: false};
const synced = {...local, server: true};

beforeEach(() => jest.clearAllMocks());

describe('signInPinFor', () => {
	it("reads the account's own record first", () => {
		expect(signInPinFor({userPins: {u1: synced}, pinCodeProtection: true}, 'u1')).toBe(synced);
	});

	it('falls back to the PIN the TV kept for every profile', () => {
		const fallback = signInPinFor({pinCodeProtection: true, pinCodeHash: hashPin('4321'), pinFailedAttempts: 2}, 'u2');
		expect(fallback).toMatchObject({enabled: true, hash: hashPin('4321'), failed: 2, server: false});
		expect(signInPinFor({pinCodeProtection: true, pinCode: '0000'}, 'u2').hash).toBe(hashPin('0000'));
	});

	it('has no PIN when the TV never turned one on', () => {
		expect(isSignInPinEnabled(signInPinFor({pinCodeProtection: false}, 'u3'))).toBe(false);
	});
});

describe('refreshSignInPin', () => {
	it('learns of a PIN the server holds', async () => {
		serverPin.getServerPinStatus.mockResolvedValue(true);
		const next = await refreshSignInPin(signInPinFor({}, 'u1'), account);
		expect(next.server).toBe(true);
		expect(isSignInPinEnabled(next)).toBe(true);
	});

	it('drops a PIN an administrator removed, but keeps one only this TV knows', async () => {
		serverPin.getServerPinStatus.mockResolvedValue(false);
		expect(isSignInPinEnabled(await refreshSignInPin(synced, account))).toBe(false);
		expect(await refreshSignInPin(local, account)).toBe(local);
	});

	it("changes nothing when the server can't say", async () => {
		serverPin.getServerPinStatus.mockResolvedValue(null);
		expect(await refreshSignInPin(synced, account)).toBe(synced);
		expect(await refreshSignInPin(synced, null)).toBe(synced);
	});
});

describe('verifySignInPin', () => {
	it("takes the server's answer and keeps a copy of a right PIN", async () => {
		serverPin.verifyServerPin.mockResolvedValue({result: serverPin.PIN_VALID});
		const {outcome, record} = await verifySignInPin({...local, failed: 3}, '5678', account);
		expect(outcome).toBe(PIN_ACCEPTED);
		expect(record).toMatchObject({hash: hashPin('5678'), failed: 0, server: true});
	});

	it('leaves counting wrong guesses to the server', async () => {
		serverPin.verifyServerPin.mockResolvedValue({result: serverPin.PIN_WRONG});
		const {outcome, record} = await verifySignInPin(synced, '0000', account);
		expect(outcome).toBe(PIN_REJECTED);
		expect(record).toBe(synced);
	});

	it("passes on the server's lockout", async () => {
		serverPin.verifyServerPin.mockResolvedValue({result: serverPin.PIN_LOCKED, wait: 60000});
		expect(await verifySignInPin(synced, '0000', account)).toMatchObject({outcome: serverPin.PIN_LOCKED, wait: 60000});
	});

	it('moves a PIN only this TV knows to a server that has none', async () => {
		serverPin.verifyServerPin.mockResolvedValue({result: serverPin.PIN_NONE});
		serverPin.setServerPin.mockResolvedValue({result: serverPin.PIN_VALID});
		const {outcome, record} = await verifySignInPin(local, '1234', account);
		expect(outcome).toBe(PIN_ACCEPTED);
		expect(serverPin.setServerPin).toHaveBeenCalledWith(account, '1234');
		expect(record.server).toBe(true);
	});

	it('lets an account in once an administrator removed its PIN', async () => {
		serverPin.verifyServerPin.mockResolvedValue({result: serverPin.PIN_NONE});
		const {outcome, record} = await verifySignInPin(synced, '0000', account);
		expect(outcome).toBe(PIN_ACCEPTED);
		expect(isSignInPinEnabled(record)).toBe(false);
	});

	it("checks the copy here, with its own lockout, when the server can't be reached", async () => {
		serverPin.verifyServerPin.mockResolvedValue({result: serverPin.PIN_UNAVAILABLE});
		expect((await verifySignInPin(synced, '1234', account)).outcome).toBe(PIN_ACCEPTED);
		const wrong = await verifySignInPin(synced, '0000', account);
		expect(wrong.outcome).toBe(PIN_REJECTED);
		expect(wrong.record.failed).toBe(1);
		const locked = await verifySignInPin({...synced, failed: 5}, '0000', null);
		expect(locked).toMatchObject({outcome: serverPin.PIN_LOCKED, wait: 30000});
	});
});

describe('storeSignInPin and dropSignInPin', () => {
	it('sets the PIN on the server with the current one and keeps a copy', async () => {
		serverPin.setServerPin.mockResolvedValue({result: serverPin.PIN_VALID});
		const {record} = await storeSignInPin(synced, '9999', account, '1234');
		expect(serverPin.setServerPin).toHaveBeenCalledWith(account, '9999', '1234');
		expect(record).toMatchObject({enabled: true, hash: hashPin('9999'), server: true});
	});

	it('keeps nothing the server turned down', async () => {
		serverPin.setServerPin.mockResolvedValue({result: serverPin.PIN_WRONG});
		expect(await storeSignInPin(synced, '9999', account, '0000')).toEqual({refused: 'Incorrect PIN'});
		serverPin.setServerPin.mockResolvedValue({result: serverPin.PIN_UNAVAILABLE});
		expect(await storeSignInPin(synced, '9999', account, '1234')).toEqual({refused: 'Unable to connect to server'});
	});

	it("keeps a PIN here when a server without the plugin can't take it", async () => {
		serverPin.setServerPin.mockResolvedValue({result: serverPin.PIN_UNAVAILABLE});
		const {record} = await storeSignInPin(signInPinFor({}, 'u1'), '2468', account);
		expect(record).toMatchObject({enabled: true, hash: hashPin('2468'), server: false});
	});

	it('removes a server PIN with the current one, and a local one without asking', async () => {
		serverPin.removeServerPin.mockResolvedValue({result: serverPin.PIN_VALID});
		expect(isSignInPinEnabled((await dropSignInPin(synced, account, '1234')).record)).toBe(false);
		expect(serverPin.removeServerPin).toHaveBeenCalledWith(account, '1234');

		serverPin.removeServerPin.mockClear();
		expect(isSignInPinEnabled((await dropSignInPin(local, account, '1234')).record)).toBe(false);
		expect(serverPin.removeServerPin).not.toHaveBeenCalled();
	});

	it("keeps a server PIN it couldn't remove there", async () => {
		serverPin.removeServerPin.mockResolvedValue({result: serverPin.PIN_UNAVAILABLE});
		expect(await dropSignInPin(synced, account, '1234')).toEqual({refused: 'Unable to connect to server'});
	});
});
