import {claimSharedVideo, ownsSharedVideo, releaseSharedVideo} from './sharedVideoOwner';

beforeEach(() => {
	releaseSharedVideo('trailer');
	releaseSharedVideo('preview');
});

describe('the shared video owner', () => {
	test('a claim evicts the previous owner before the new one holds the element', () => {
		const seen = [];
		claimSharedVideo('preview', () => {
			// The evicted owner still owns it while it puts its stream away.
			seen.push(ownsSharedVideo('preview'));
			releaseSharedVideo('preview');
		});

		claimSharedVideo('trailer', () => {});

		expect(seen).toEqual([true]);
		expect(ownsSharedVideo('trailer')).toBe(true);
		expect(ownsSharedVideo('preview')).toBe(false);
	});

	test('the same owner claiming again isn\'t evicted', () => {
		const evict = jest.fn();
		claimSharedVideo('trailer', evict);
		claimSharedVideo('trailer', evict);

		expect(evict).not.toHaveBeenCalled();
		expect(ownsSharedVideo('trailer')).toBe(true);
	});

	test('a release from anyone but the owner changes nothing', () => {
		claimSharedVideo('preview', () => {});
		releaseSharedVideo('trailer');

		expect(ownsSharedVideo('preview')).toBe(true);
	});

	test('an evict that throws still hands the element over', () => {
		claimSharedVideo('preview', () => {
			throw new Error('boom');
		});

		claimSharedVideo('trailer', () => {});

		expect(ownsSharedVideo('trailer')).toBe(true);
	});
});
