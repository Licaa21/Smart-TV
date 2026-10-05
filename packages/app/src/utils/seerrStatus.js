import $L from '@enact/i18n/$L';

export const MEDIA_STATUS = {
	UNKNOWN: 1,
	PENDING: 2,
	PROCESSING: 3,
	PARTIALLY_AVAILABLE: 4,
	AVAILABLE: 5,
	BLOCKLISTED: 6,
	DELETED: 7
};

export const REQUEST_STATUS = {
	PENDING: 1,
	APPROVED: 2,
	DECLINED: 3,
	FAILED: 4,
	COMPLETED: 5
};

export const ISSUE_STATUS = {
	OPEN: 1,
	RESOLVED: 2
};

export const ISSUE_TYPE = {
	VIDEO: 1,
	AUDIO: 2,
	SUBTITLES: 3,
	OTHER: 4
};

export const isUnlimitedQuota = (quota) => !quota || quota.limit == null || quota.limit === 0;

export const getIssueTypeLabel = (issueType) => {
	switch (issueType) {
		case ISSUE_TYPE.VIDEO: return $L('Video');
		case ISSUE_TYPE.AUDIO: return $L('Audio');
		case ISSUE_TYPE.SUBTITLES: return $L('Subtitles');
		default: return $L('Other');
	}
};

// The request's own status wins only for declined and failed. Everything else
// reflects the media status, so a completed request whose media was deleted
// since reads as deleted rather than available. Seerr shows one media status
// as two words, processing while something is in the download queue and
// requested while nothing is. Only when the media status is unknown does the
// request status decide.
export const getRequestStatusInfo = (req) => {
	if (req.status === REQUEST_STATUS.DECLINED) {
		return {label: $L('Declined'), color: 'error'};
	}
	if (req.status === REQUEST_STATUS.FAILED) {
		return {label: $L('Failed'), color: 'error'};
	}

	const media = req.media || {};
	const mediaStatus = req.is4k ? media.status4k : media.status;
	const queue = req.is4k ? media.downloadStatus4k : media.downloadStatus;
	const inProgress = Array.isArray(queue) && queue.length > 0;
	switch (mediaStatus) {
		case MEDIA_STATUS.PENDING:
			return {label: $L('Pending'), color: 'pending'};
		case MEDIA_STATUS.PROCESSING:
			return inProgress
				? {label: $L('Processing'), color: 'requested'}
				: {label: $L('Requested'), color: 'requested'};
		case MEDIA_STATUS.PARTIALLY_AVAILABLE:
			return inProgress
				? {label: $L('Processing'), color: 'requested'}
				: {label: $L('Partially Available'), color: 'available'};
		case MEDIA_STATUS.AVAILABLE:
			return {label: $L('Available'), color: 'available'};
		case MEDIA_STATUS.BLOCKLISTED:
			return {label: $L('Blocklisted'), color: 'error'};
		case MEDIA_STATUS.DELETED:
			return {label: $L('Deleted'), color: 'error'};
	}

	if (req.status === REQUEST_STATUS.PENDING) {
		return {label: $L('Pending'), color: 'pending'};
	}
	if (req.status === REQUEST_STATUS.COMPLETED) {
		return {label: $L('Available'), color: 'available'};
	}
	return {label: $L('Approved'), color: 'approved'};
};

export const getIssueStatusInfo = (issue) => {
	return issue.status === ISSUE_STATUS.OPEN
		? {label: $L('Open'), color: 'pending'}
		: {label: $L('Resolved'), color: 'available'};
};

// Aggregates the Radarr/Sonarr queue entries Seerr reports in downloadStatus.
// Sums bytes so a large episode weighs more than a small one. Returns null
// when nothing is downloading, which falls back to the status chip alone. The
// byte counts ride along so the bar can say how much is left.
export const getDownloadSummary = (items) => {
	if (!Array.isArray(items) || items.length === 0) return null;
	let total = 0;
	let left = 0;
	for (const item of items) {
		const size = item && item.size;
		if (typeof size !== 'number' || size <= 0) continue;
		total += size;
		const sizeLeft = typeof item.sizeLeft === 'number' ? item.sizeLeft : 0;
		left += Math.min(Math.max(sizeLeft, 0), size);
	}
	if (total <= 0) return null;
	return {
		fraction: Math.min(Math.max((total - left) / total, 0), 1),
		isImporting: left <= 0,
		totalBytes: total,
		downloadedBytes: total - left
	};
};

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

export const formatBytes = (bytes) => {
	if (!(bytes >= 0)) return '0 B';
	if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
	if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
	if (bytes >= KB) return `${(bytes / KB).toFixed(1)} KB`;
	return `${Math.round(bytes)} B`;
};

// The done half in the total's unit, so it reads 1.6 GB / 4.4 GB rather than
// 330.9 MB / 12.4 GB.
const sameUnitAs = (bytes, reference) => (reference < GB ? formatBytes(bytes) : `${(bytes / GB).toFixed(1)} GB`);

// The two halves of the download bar's label. A tile has no room for the verb,
// so compact drops it and keeps the sizes, which ellipsize while the percentage
// stays put. Without usable sizes the verb stands in for them.
export const downloadLabelParts = (summary, compact = false) => {
	if (summary.isImporting) return {leading: $L('Importing'), percent: null};
	const percent = `${Math.round(summary.fraction * 100)}%`;
	if (!(summary.totalBytes > 0)) {
		return {leading: compact ? null : $L('Downloading'), percent};
	}
	const sizes = `${sameUnitAs(summary.downloadedBytes, summary.totalBytes)} / ${formatBytes(summary.totalBytes)}`;
	return {leading: compact ? sizes : `${$L('Downloading')} · ${sizes}`, percent};
};

// The status gate keeps stale queue entries from drawing a bar after the
// media has become available.
export const getMediaDownloadSummary = (media, is4k) => {
	if (!media) return null;
	const status = is4k ? media.status4k : media.status;
	if (status !== MEDIA_STATUS.PROCESSING && status !== MEDIA_STATUS.PARTIALLY_AVAILABLE) {
		return null;
	}
	return getDownloadSummary(is4k ? media.downloadStatus4k : media.downloadStatus);
};

const isOnItsWay = (status) => status === MEDIA_STATUS.PENDING || status === MEDIA_STATUS.PROCESSING;

// Whether the title or one of its seasons is still on its way into the library on this
// track, waiting on approval, a download or the import.
export const isMediaInFlight = (media, is4k) => {
	if (!media) return false;
	if (isOnItsWay(is4k ? media.status4k : media.status)) return true;
	if (getMediaDownloadSummary(media, is4k)) return true;
	return (media.seasons || []).some((season) => isOnItsWay(is4k ? season.status4k : season.status));
};

// Summary for a request row, using the request's quality flavor and skipping
// requests that can no longer be downloading.
export const getRequestDownloadSummary = (req) => {
	if (req.status === REQUEST_STATUS.DECLINED || req.status === REQUEST_STATUS.FAILED) {
		return null;
	}
	return getMediaDownloadSummary(req.media, req.is4k);
};

export const isRequestDownloading = (req) => getRequestDownloadSummary(req) !== null;
