jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));

import {
	MEDIA_STATUS,
	REQUEST_STATUS,
	getRequestStatusInfo,
	getDownloadSummary,
	formatBytes,
	downloadLabelParts,
	isMediaInFlight
} from './seerrStatus';

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

const request = (over = {}) => ({status: REQUEST_STATUS.APPROVED, is4k: false, media: {}, ...over});

describe('getRequestStatusInfo', () => {
	test('declined and failed are the request status, whatever the media says', () => {
		expect(getRequestStatusInfo(request({status: REQUEST_STATUS.DECLINED, media: {status: MEDIA_STATUS.AVAILABLE}})).label).toBe('Declined');
		expect(getRequestStatusInfo(request({status: REQUEST_STATUS.FAILED, media: {status: MEDIA_STATUS.AVAILABLE}})).label).toBe('Failed');
	});

	test('a completed request whose media was deleted reads as deleted', () => {
		const info = getRequestStatusInfo(request({status: REQUEST_STATUS.COMPLETED, media: {status: MEDIA_STATUS.DELETED}}));

		expect(info).toEqual({label: 'Deleted', color: 'error'});
	});

	test('processing while something is queued, requested while nothing is', () => {
		const queued = request({media: {status: MEDIA_STATUS.PROCESSING, downloadStatus: [{size: 1}]}});
		const idle = request({media: {status: MEDIA_STATUS.PROCESSING, downloadStatus: []}});

		expect(getRequestStatusInfo(queued).label).toBe('Processing');
		expect(getRequestStatusInfo(idle).label).toBe('Requested');
	});

	test('partially available says processing while the rest downloads', () => {
		const queued = request({media: {status: MEDIA_STATUS.PARTIALLY_AVAILABLE, downloadStatus: [{size: 1}]}});
		const idle = request({media: {status: MEDIA_STATUS.PARTIALLY_AVAILABLE}});

		expect(getRequestStatusInfo(queued).label).toBe('Processing');
		expect(getRequestStatusInfo(idle)).toEqual({label: 'Partially Available', color: 'available'});
	});

	test('a 4K request reads the 4K side of the media', () => {
		const info = getRequestStatusInfo(request({is4k: true, media: {status: MEDIA_STATUS.AVAILABLE, status4k: MEDIA_STATUS.PROCESSING, downloadStatus4k: [{size: 1}]}}));

		expect(info.label).toBe('Processing');
	});

	test('only an unknown media status falls back to the request status', () => {
		expect(getRequestStatusInfo(request({status: REQUEST_STATUS.PENDING})).label).toBe('Pending');
		expect(getRequestStatusInfo(request({status: REQUEST_STATUS.COMPLETED})).label).toBe('Available');
		expect(getRequestStatusInfo(request({status: REQUEST_STATUS.APPROVED})).label).toBe('Approved');
		expect(getRequestStatusInfo(request({status: REQUEST_STATUS.APPROVED, media: null})).label).toBe('Approved');
	});
});

describe('getDownloadSummary', () => {
	test('carries the byte counts alongside the fraction', () => {
		const summary = getDownloadSummary([{size: 4 * GB, sizeLeft: 3 * GB}, {size: 1 * GB, sizeLeft: 0}]);

		expect(summary.totalBytes).toBe(5 * GB);
		expect(summary.downloadedBytes).toBe(2 * GB);
		expect(summary.fraction).toBeCloseTo(0.4);
		expect(summary.isImporting).toBe(false);
	});

	test('nothing left to fetch means importing', () => {
		expect(getDownloadSummary([{size: 10, sizeLeft: 0}]).isImporting).toBe(true);
	});

	test('entries without a size are left out, and no sizes at all is nothing', () => {
		expect(getDownloadSummary([{size: 0}, {}])).toBeNull();
		expect(getDownloadSummary([])).toBeNull();
		expect(getDownloadSummary(null)).toBeNull();
	});
});

describe('formatBytes', () => {
	test('picks the unit that fits', () => {
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(formatBytes(2.5 * MB)).toBe('2.5 MB');
		expect(formatBytes(4.4 * GB)).toBe('4.4 GB');
		expect(formatBytes(-1)).toBe('0 B');
	});
});

describe('downloadLabelParts', () => {
	const summary = {fraction: 0.09, isImporting: false, totalBytes: 15 * GB, downloadedBytes: 1.4 * GB};

	test('wide: the verb, both sizes and the percentage', () => {
		expect(downloadLabelParts(summary)).toEqual({leading: 'Downloading · 1.4 GB / 15.0 GB', percent: '9%'});
	});

	test('compact: drops the verb and keeps the sizes', () => {
		expect(downloadLabelParts(summary, true)).toEqual({leading: '1.4 GB / 15.0 GB', percent: '9%'});
	});

	test("both halves use the total's unit", () => {
		const small = {fraction: 0.5, isImporting: false, totalBytes: 12.4 * GB, downloadedBytes: 330.9 * MB};

		expect(downloadLabelParts(small, true).leading).toBe('0.3 GB / 12.4 GB');
		const mb = {fraction: 0.5, isImporting: false, totalBytes: 700 * MB, downloadedBytes: 350 * MB};
		expect(downloadLabelParts(mb, true).leading).toBe('350.0 MB / 700.0 MB');
	});

	test('no usable sizes: the verb stands in, and compact keeps only the percentage', () => {
		const bare = {fraction: 0.09, isImporting: false};

		expect(downloadLabelParts(bare)).toEqual({leading: 'Downloading', percent: '9%'});
		expect(downloadLabelParts(bare, true)).toEqual({leading: null, percent: '9%'});
	});

	test('importing says so instead of a stuck 100%', () => {
		expect(downloadLabelParts({fraction: 1, isImporting: true, totalBytes: GB, downloadedBytes: GB})).toEqual({leading: 'Importing', percent: null});
	});
});

describe('isMediaInFlight', () => {
	test('a title stays in flight from the request until it lands', () => {
		expect(isMediaInFlight({status: MEDIA_STATUS.PENDING}, false)).toBe(true);
		expect(isMediaInFlight({status: MEDIA_STATUS.PROCESSING}, false)).toBe(true);
		expect(isMediaInFlight({status: MEDIA_STATUS.AVAILABLE}, false)).toBe(false);
		expect(isMediaInFlight({status: MEDIA_STATUS.UNKNOWN}, false)).toBe(false);
	});

	test('a newly requested season keeps a partial series in flight', () => {
		const media = {
			status: MEDIA_STATUS.PARTIALLY_AVAILABLE,
			status4k: MEDIA_STATUS.UNKNOWN,
			seasons: [
				{seasonNumber: 1, status: MEDIA_STATUS.AVAILABLE, status4k: MEDIA_STATUS.UNKNOWN},
				{seasonNumber: 2, status: MEDIA_STATUS.PENDING, status4k: MEDIA_STATUS.UNKNOWN}
			]
		};
		expect(isMediaInFlight(media, false)).toBe(true);
		expect(isMediaInFlight(media, true)).toBe(false);
	});

	test('a partly available title with a download running is in flight', () => {
		const media = {status: MEDIA_STATUS.PARTIALLY_AVAILABLE, downloadStatus: [{size: 100, sizeLeft: 40}]};
		expect(isMediaInFlight(media, false)).toBe(true);
	});

	test('no media means nothing is on its way', () => {
		expect(isMediaInFlight(null, false)).toBe(false);
	});
});
