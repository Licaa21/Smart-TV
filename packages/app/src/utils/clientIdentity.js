// What the app calls itself and its version when it signs in to a server, which is what Jellyfin's devices page lists. A
// package the fork built carries the fork's own version (REACT_APP_FORK_VERSION), and then it is "Moonfin Lica's Fork" at
// that version. Anywhere else (the dev server, the browser) it stays Moonfin's own name and version.
export const FORK_CLIENT_NAME = "Moonfin Lica's Fork";

export const clientIdentity = (platformName, moonfinVersion, forkVersion) => (
	forkVersion ? {appName: FORK_CLIENT_NAME, appVersion: forkVersion} : {appName: platformName, appVersion: moonfinVersion}
);
