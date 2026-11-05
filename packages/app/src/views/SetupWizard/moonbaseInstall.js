import $L from '@enact/i18n/$L';

// The fork's own Moonbase, which carries the TMDB routes and the Smart Search tuning this app reads. It has the same id as
// upstream's, so installing upstream's over it would take those away.
export const MOONBASE_MANIFEST_URL = 'https://raw.githubusercontent.com/Licaa21/Plugin/refs/heads/main/manifest.json';
const MOONBASE_NAME = 'Moonbase';
const MOONBASE_GUID = '8c5d0e91-4f2a-4b6d-9e3f-1a7c8d9e0f2b';

export const moonbaseGuideUrl = () => 'https://github.com/Licaa21/Plugin';

// The row is only offered where the fork's Moonbase can go, a Jellyfin server, and only when the server said it has no
// Moonbase: the plugin's Ping answers 404 or says it is not installed. A ping that failed any other way (a timeout, a
// refused token, no network) says nothing about the plugin, and a plugin that is installed with its settings sync switched
// off is still installed.
export const shouldOfferMoonbase = (serverType, ping, failure) => {
	if (serverType !== 'jellyfin') return false;
	if (failure) return failure.status === 404;
	return ping?.installed === false;
};

// Moonbase for Plex and Silo can't read the library, so they offer less.
export const moonbaseFeatures = (serverType) => {
	const fullPlugin = serverType !== 'plex' && serverType !== 'silo';
	return [
		$L('Settings synced across your devices'),
		$L('Extra ratings and TMDB reviews'),
		...(fullPlugin ? [$L('Seerr requests'), $L('Custom rows from your favorite lists'), $L('Retro games with synced saves')] : []),
		...(serverType === 'silo' ? [] : [$L("A calendar of what's coming up")]),
		...(fullPlugin ? [] : [$L('Your own order for each collection')]),
		$L('Custom themes'),
		$L('Messages from your server admin')
	];
};

// Leaving the version out lets Jellyfin pick the newest one the server can
// run. It answers once the plugin is on disk, and the plugin turns on at the
// next restart.
export const installMoonbase = async (api) => {
	const repos = (await api.getRepositories()) || [];
	if (!repos.some((repo) => repo.Url === MOONBASE_MANIFEST_URL && repo.Enabled !== false)) {
		await api.setRepositories([
			...repos.filter((repo) => repo.Url !== MOONBASE_MANIFEST_URL),
			{Name: MOONBASE_NAME, Url: MOONBASE_MANIFEST_URL, Enabled: true}
		]);
	}
	await api.installPackage(MOONBASE_NAME, {assemblyGuid: MOONBASE_GUID, repositoryUrl: MOONBASE_MANIFEST_URL});
};
