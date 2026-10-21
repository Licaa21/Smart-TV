// Signs in to the user's own Jellyfin server and Seerr for the Playwright browser tool (see "Testing against the real
// server" in CLAUDE.md). The tool's code cannot read files, so this writes the snippet to run into .playwright-mcp/, which
// git ignores, with the session in it, and the tool runs that file the way it runs browser-mock.js:
//   node fork-tools/make-real-session.js [Claude|Lica]
// The address and the login are read from local/test-server.md, which git ignores, so no secret is ever in this file. It
// signs in as the test user Claude, or as the administrator Lica for what only an administrator sees. Prints no secret.
const fs = require('fs');
const path = require('path');

const as = process.argv[2] === 'Lica' ? 'Lica' : 'Claude';
const root = path.resolve(__dirname, '..', '..');
const text = fs.readFileSync(path.join(root, 'local', 'test-server.md'), 'utf8');
const base = (text.match(/Server:\s*(http:\/\/\S+)/) || [])[1];
const section = as === 'Lica' ? text.split('## The test user')[0] : text.split('## The test user')[1];
const password = (section.match(/Password:\s*(\S+)/) || [])[1];
const auth = 'MediaBrowser Client="Moonfin", Device="Claude Code", DeviceId="claude-code-browser", Version="2.10.0"';

const call = async (url, options = {}, token) => {
	const res = await fetch(base + url, {...options, headers: {'Content-Type': 'application/json', Authorization: token ? `${auth}, Token="${token}"` : auth}});
	return {status: res.status, data: await res.json().catch(() => null)};
};

(async () => {
	const login = await call('/Users/AuthenticateByName', {method: 'POST', body: JSON.stringify({Username: as, Pw: password})});
	if (login.status !== 200) throw new Error(`Sign in as ${as} failed: ${login.status}`);
	const token = login.data.AccessToken;
	const userId = login.data.User.Id;
	const info = (await call('/System/Info/Public')).data;
	// The plugin keeps the Seerr session on the server, made once per user the way the app's own Seerr sign in does
	const status = (await call('/Moonfin/Seerr/Status', {}, token)).data || {};
	if (!status.authenticated) await call('/Moonfin/Seerr/Login', {method: 'POST', body: JSON.stringify({username: as, password, authType: 'jellyfin'})}, token);

	const session = {base, as, token, userId, serverId: info.Id, serverName: info.ServerName};
	const snippet = `// Made by fork-tools/make-real-session.js, with a session in it. Ignored by git, never commit it.
async (page) => {
	const s = ${JSON.stringify(session)};
	await page.goto('http://127.0.0.1:8123/');
	await page.evaluate((s) => {
		const set = (k, v) => localStorage.setItem('moonfin_' + k, JSON.stringify(v));
		set('jellyfin_servers', {[s.serverId]: {name: s.serverName, url: s.base, serverType: 'jellyfin', addedDate: 1, users: {[s.userId]: {username: s.as, accessToken: s.token, connected: true, lastConnected: Date.now()}}}});
		set('jellyfin_active_server', s.serverId);
		set('jellyfin_active_user', s.userId);
		set('seerr', {moonfin: true, jellyfinServerUrl: s.base, jellyfinAccessToken: s.token});
	}, s);
	await page.reload();
	await page.waitForTimeout(6000);
	return 'signed in as ' + s.as + ' on ' + s.serverName;
}
`;
	const out = path.join(__dirname, '..', '.playwright-mcp');
	fs.mkdirSync(out, {recursive: true});
	fs.writeFileSync(path.join(out, 'real-session.js'), snippet);
	console.log(`Wrote .playwright-mcp/real-session.js for ${as} on ${info.ServerName}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
