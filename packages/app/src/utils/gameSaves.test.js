jest.mock('../services/gamesApi', () => ({getStateBytes: jest.fn(), putStateBytes: jest.fn(), getSram: jest.fn(), putSram: jest.fn()}));
jest.mock('../services/jellyfinApi', () => ({getServerUrl: () => 'https://server', getUserId: () => 'user'}));

import * as gamesApi from '../services/gamesApi';
import {gameStateKey, loadGameStateWithMigration, loadSram, saveSram} from './gameSaves';

describe('gameStateKey', () => {
	it('namespaces EmulatorJS save states by core', () => {
		expect(gameStateKey('opaque-token', 'arcade')).toBe('ejs-arcade-opaque-token');
		expect(gameStateKey('opaque-token', 'mame')).toBe('ejs-mame-opaque-token');
	});
});

describe('loadGameStateWithMigration', () => {
	const saves = (map) => {
		gamesApi.getStateBytes.mockImplementation((key) => Promise.resolve(key in map ? map[key] : null));
	};

	beforeEach(() => {
		gamesApi.getStateBytes.mockReset();
		gamesApi.putStateBytes.mockReset();
		gamesApi.putStateBytes.mockResolvedValue(undefined);
	});

	it('returns the new-key save and never touches the legacy key', async () => {
		saves({'ejs-arcade-game1': new Uint8Array([1, 2, 3])});

		const result = await loadGameStateWithMigration('game1', 'arcade');

		expect(Array.from(result)).toEqual([1, 2, 3]);
		expect(gamesApi.getStateBytes).not.toHaveBeenCalledWith('game1');
		expect(gamesApi.putStateBytes).not.toHaveBeenCalled();
	});

	it('falls back to the legacy key on a miss and migrates it to the new key', async () => {
		const legacy = new Uint8Array([4, 5, 6]);
		saves({game1: legacy});

		const result = await loadGameStateWithMigration('game1', 'arcade');

		expect(result).toBe(legacy);
		expect(gamesApi.putStateBytes).toHaveBeenCalledTimes(1);
		expect(gamesApi.putStateBytes).toHaveBeenCalledWith('ejs-arcade-game1', legacy);
	});

	it('returns null when neither the new nor the legacy key has a save', async () => {
		saves({});

		const result = await loadGameStateWithMigration('game1', 'arcade');

		expect(result).toBeNull();
		expect(gamesApi.putStateBytes).not.toHaveBeenCalled();
	});

	it('still returns the legacy save when copying it forward fails', async () => {
		const legacy = new Uint8Array([7]);
		saves({game1: legacy});
		gamesApi.putStateBytes.mockRejectedValue(new Error('offline'));

		await expect(loadGameStateWithMigration('game1', 'arcade')).resolves.toBe(legacy);
	});

	it('throws on a failed new-key read instead of copying the legacy save over it', async () => {
		gamesApi.getStateBytes.mockImplementation((key) => (key === 'game1'
			? Promise.resolve(new Uint8Array([8]))
			: Promise.reject(Object.assign(new Error('Save fetch error: 500'), {status: 500}))));

		await expect(loadGameStateWithMigration('game1', 'arcade')).rejects.toMatchObject({status: 500});
		expect(gamesApi.putStateBytes).not.toHaveBeenCalled();
	});
});

describe('battery saves', () => {
	beforeEach(() => {
		window.localStorage.clear();
		gamesApi.getSram.mockReset();
		gamesApi.putSram.mockReset();
	});

	it('downloads the server copy when nothing is waiting to upload', async () => {
		gamesApi.getSram.mockResolvedValue(new Uint8Array([1]));

		expect(Array.from(await loadSram('g1'))).toEqual([1]);
		expect(gamesApi.putSram).not.toHaveBeenCalled();
	});

	it('reads a failed download as no battery save', async () => {
		gamesApi.getSram.mockRejectedValue(new Error('network'));

		await expect(loadSram('g1')).resolves.toBeNull();
	});

	it('keeps a failed upload and sends it before the next launch instead of downloading', async () => {
		gamesApi.putSram.mockRejectedValueOnce(new Error('network'));
		await saveSram('g1', new Uint8Array([5, 6]));

		gamesApi.putSram.mockResolvedValueOnce(undefined);
		const loaded = await loadSram('g1');

		expect(Array.from(loaded)).toEqual([5, 6]);
		expect(Array.from(gamesApi.putSram.mock.calls[1][1])).toEqual([5, 6]);
		expect(gamesApi.getSram).not.toHaveBeenCalled();

		gamesApi.getSram.mockResolvedValue(null);
		await loadSram('g1');
		expect(gamesApi.getSram).toHaveBeenCalled();
	});

	it('skips an empty battery save', async () => {
		await saveSram('g1', null);

		expect(gamesApi.putSram).not.toHaveBeenCalled();
	});
});
