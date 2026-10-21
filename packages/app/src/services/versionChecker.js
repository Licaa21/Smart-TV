/**
 * Version Checker Service
 * Checks GitHub releases API for newer versions on every start
 * and version dismissal capability. Only notifies when a release contains
 * the platform-specific asset (.ipk for webOS, .wgt for Tizen).
 */

import $L from '@enact/i18n/$L';

import {getFromStorage, saveToStorage} from './storage';
import {isTizen, isVega, isWebOS, isXbox} from '../platform';
import packageJson from '../../package.json';
// A package built by the fork's build script carries the fork's own version (1.1.2), and the update check watches the fork's
// releases for a newer one. Anywhere else (the dev server, the browser) there is none, and Moonfin's own version stands in.
const APP_VERSION = process.env.REACT_APP_FORK_VERSION || packageJson.version;

const GITHUB_RELEASES_URL = 'https://api.github.com/repos/Licaa21/Smart-TV/releases';
// The fork has few releases to ask about, so every start asks, which is what a package being tried needs to see its update
const CHECK_COOLDOWN_HOURS = 0;
const STORAGE_KEY_LAST_CHECK = 'version_last_check';
const STORAGE_KEY_DISMISSED_VERSION = 'version_dismissed';

/**
 * Get current application version
 * @returns {string} Current version string
 */
export const getCurrentVersion = () => {
	return APP_VERSION;
};

// What Settings shows as the version: Moonfin's, with the fork's after it on a package the fork built
export const getDisplayVersion = () => {
	const moonfin = process.env.REACT_APP_VERSION || '0.0.0';
	return process.env.REACT_APP_FORK_VERSION ? moonfin + " (Lica's Fork " + process.env.REACT_APP_FORK_VERSION + ')' : moonfin;
};

/**
 * Compare two version strings
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export const compareVersions = (v1, v2) => {
	const cleanV1 = v1.replace(/^v/, '');
	const cleanV2 = v2.replace(/^v/, '');

	const parts1 = cleanV1.split('.').map(n => parseInt(n, 10) || 0);
	const parts2 = cleanV2.split('.').map(n => parseInt(n, 10) || 0);

	const maxLength = Math.max(parts1.length, parts2.length);

	for (let i = 0; i < maxLength; i++) {
		const part1 = parts1[i] || 0;
		const part2 = parts2[i] || 0;

		if (part1 < part2) return -1;
		if (part1 > part2) return 1;
	}

	return 0;
};

/**
 * Check if enough time has passed since last check
 * @returns {Promise<boolean>} True if we should check for updates
 */
const shouldCheckForUpdate = async () => {
	try {
		const lastCheck = await getFromStorage(STORAGE_KEY_LAST_CHECK);
		if (!lastCheck) return true;

		const lastCheckTime = parseInt(lastCheck, 10);
		const now = Date.now();
		const hoursSinceCheck = (now - lastCheckTime) / (1000 * 60 * 60);

		return hoursSinceCheck >= CHECK_COOLDOWN_HOURS;
	} catch {
		return true;
	}
};

/**
 * Mark that we've checked for updates
 */
const markChecked = async () => {
	try {
		await saveToStorage(STORAGE_KEY_LAST_CHECK, Date.now().toString());
	} catch (e) {
		console.warn('[VERSION] Failed to save check timestamp:', e);
	}
};

/**
 * Check if user dismissed this version
 * @param {string} version - Version to check
 * @returns {Promise<boolean>} True if dismissed
 */
const isVersionDismissed = async (version) => {
	try {
		const dismissedVersion = await getFromStorage(STORAGE_KEY_DISMISSED_VERSION);
		return dismissedVersion === version;
	} catch {
		return false;
	}
};

/**
 * Mark version as dismissed
 * @param {string} version - Version to dismiss
 */
export const dismissVersion = async (version) => {
	try {
		await saveToStorage(STORAGE_KEY_DISMISSED_VERSION, version);
	} catch (e) {
		console.warn('[VERSION] Failed to save dismissed version:', e);
	}
};

/**
 * Clear version check cache (for testing)
 * Resets cooldown timer and dismissed version
 */
export const clearVersionCache = async () => {
	try {
		await saveToStorage(STORAGE_KEY_LAST_CHECK, null);
		await saveToStorage(STORAGE_KEY_DISMISSED_VERSION, null);
	} catch (e) {
		console.warn('[VERSION] Failed to clear cache:', e);
	}
};

/**
 * Get the expected asset file extension for this platform
 * @returns {string} '.ipk' for webOS, '.wgt' for Tizen, '.vpkg' for Fire TV, '.msix' for Xbox
 */
const getPlatformAssetExtension = () => {
	if (isWebOS()) return '.ipk';
	if (isTizen()) return '.wgt';
	if (isVega()) return '.vpkg';
	if (isXbox()) return '.msix';
	return '';
};

/**
 * Check if a release has an asset matching this platform
 * @param {Object} release
 * @returns {boolean}
 */
const releaseHasPlatformAsset = (release) => {
	const ext = getPlatformAssetExtension();
	if (!ext) return true; // unknown platform, don't filter
	const assets = release.assets || [];
	return assets.some(a => a.name?.toLowerCase().endsWith(ext));
};

/**
 * Fetch the latest release that contains a platform-specific asset.
 * Walks recent releases (up to 10) to find one with an .ipk or .wgt file.
 * @returns {Promise<Object|null>}
 */
const fetchLatestRelease = async () => {
	try {
		const response = await fetch(`${GITHUB_RELEASES_URL}?per_page=10`, {
			headers: {
				'Accept': 'application/vnd.github+json',
				'User-Agent': 'Moonfin-Client'
			}
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		const releases = await response.json();
		if (!Array.isArray(releases)) return null;

		// Find the first non-draft, non-prerelease release with a matching asset
		for (const release of releases) {
			if (release.draft || release.prerelease) continue;
			if (releaseHasPlatformAsset(release)) {
				return release;
			}
		}

		return null;
	} catch (e) {
		console.warn('[VERSION] Failed to fetch release info:', e);
		return null;
	}
};

/**
 * Notes to show in the update panel, or a line to stand in when a release
 * carried none. The markdown itself is rendered by the panel.
 * @param {string} notes - Raw release notes
 * @returns {string} Markdown to render
 */
export const formatReleaseNotes = (notes) => {
	if (!notes) return $L('A new version is available. Visit GitHub to download.');
	return notes;
};

// The settings row wants an answer either way, unlike the launch check below
// that stays quiet when a version was dismissed or nothing is new.
export const checkForUpdatesDetailed = async () => {
	const currentVersion = getCurrentVersion();
	try {
		const releaseInfo = await fetchLatestRelease();
		await markChecked();
		if (!releaseInfo || !releaseInfo.tag_name) return {status: 'error', currentVersion};
		const latestVersion = releaseInfo.tag_name.replace(/^(fork-)?v/, '');
		if (compareVersions(currentVersion, latestVersion) < 0) {
			return {status: 'update', currentVersion, latestVersion};
		}
		return {status: 'current', currentVersion, latestVersion};
	} catch (e) {
		void e;
		return {status: 'error', currentVersion};
	}
};

/**
 * Check for updates
 * @param {boolean} forceCheck - Skip cooldown check
 * @returns {Promise<Object|null>} Update info if available, null otherwise
 */
export const checkForUpdates = async (forceCheck = false) => {
	if (!forceCheck) {
		const shouldCheck = await shouldCheckForUpdate();
		if (!shouldCheck) {
			return null;
		}
	}

	const currentVersion = getCurrentVersion();
	const releaseInfo = await fetchLatestRelease();

	await markChecked();

	if (!releaseInfo || !releaseInfo.tag_name) {
		return null;
	}

	const latestVersion = releaseInfo.tag_name.replace(/^(fork-)?v/, '');

	if (compareVersions(currentVersion, latestVersion) < 0) {
		const dismissed = await isVersionDismissed(latestVersion);
		// A check the viewer asked for shows the update again even when its notice was dismissed before
		if (!dismissed || forceCheck) {
			return {
				currentVersion,
				latestVersion,
				releaseNotes: releaseInfo.body,
				releaseUrl: releaseInfo.html_url,
				publishedAt: releaseInfo.published_at
			};
		}
	}

	return null;
};
