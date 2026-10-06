// A fake Jellyfin and Seerr for checking screens in a browser without a server. Run it from the
// Playwright browser tool against the dev server (npm run dev:tizen, port 8123): it seeds a signed in
// user, answers the server calls and draws placeholder posters. Extend the routes for what a screen needs.
async (page) => {
	const ctx = page.context();
	const json = (route, body, status = 200) => route.fulfill({status, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(body)});
	const svg = (label, w, h, hue) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="hsl(${hue},45%,32%)"/><text x="50%" y="50%" fill="white" font-size="${Math.round(w / 9)}" text-anchor="middle" font-family="sans-serif">${label}</text></svg>`;
	let n = 0;
	const makeItems = (kind, count, base) => Array.from({length: count}, (_, i) => {
		const id = base + i;
		const isMovie = kind === 'movie' || (kind === 'mixed' && i % 2 === 0);
		const item = {
			id, mediaType: isMovie ? 'movie' : 'tv', media_type: isMovie ? 'movie' : 'tv',
			overview: 'A mocked overview for title ' + id + '.',
			poster_path: '/p' + id + '.jpg', backdrop_path: '/b' + id + '.jpg', vote_average: 7.4,
			mediaInfo: i % 4 === 1 ? {status: 5, tmdbId: id} : undefined
		};
		if (isMovie) { item.title = 'Movie ' + id; item.release_date = '2025-01-0' + ((i % 9) + 1); } else { item.name = 'Show ' + id; item.first_air_date = '2024-02-0' + ((i % 9) + 1); }
		return item;
	});
	await ctx.route('**/image.tmdb.org/**', (route) => {
		const u = route.request().url();
		const isBackdrop = /\/b\d+/.test(u) || /w(780|1280|300)/.test(u);
		const label = (u.match(/\/([pb]\d+)\./) || [, 'img'])[1];
		return route.fulfill({status: 200, contentType: 'image/svg+xml', body: svg(label, isBackdrop ? 640 : 300, isBackdrop ? 360 : 450, (label.length * 53 + n++ * 37) % 360)});
	});
	await ctx.route('**/mock.test/**', async (route) => {
		const url = new URL(route.request().url());
		const path = url.pathname;
		if (route.request().method() === 'OPTIONS') return route.fulfill({status: 204, headers: {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*'}});
		if (path === '/Moonfin/Seerr/Status') return json(route, {authenticated: true, displayName: 'Tester', seerrUserId: 1, permissions: 2, url: 'http://seerr.test'});
		if (path === '/Moonfin/Seerr/Config') return json(route, {enabled: true, url: 'http://seerr.test', variant: 'seerr', displayName: 'Seerr'});
		if (path.startsWith('/Moonfin/Seerr/Api/')) {
			const p = path.replace('/Moonfin/Seerr/Api/', '');
			if (p.startsWith('discover/genreslider')) return json(route, ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Horror', 'Animation', 'Thriller'].map((name, i) => ({id: 10 + i, name, backdrops: ['/b' + (500 + i) + '.jpg']})));
			if (p.startsWith('discover/movies/upcoming')) return json(route, {page: 1, results: makeItems('movie', 20, 300)});
			if (p.startsWith('discover/tv/upcoming')) return json(route, {page: 1, results: makeItems('tv', 20, 400)});
			if (p.startsWith('discover/movies')) return json(route, {page: 1, results: makeItems('movie', 20, 100)});
			if (p.startsWith('discover/tv')) return json(route, {page: 1, results: makeItems('tv', 20, 200)});
			if (p.startsWith('discover/trending')) return json(route, {page: 1, results: makeItems('mixed', 20, 1)});
			if (p === 'auth/me') return json(route, {id: 1, displayName: 'Tester', permissions: 2});
			if (p.startsWith('request/count')) return json(route, {pending: 2});
			if (p.startsWith('issue/count')) return json(route, {open: 1});
			if (p.startsWith('request')) return json(route, {pageInfo: {results: 3}, results: [
				{id: 1, status: 1, type: 'movie', media: {tmdbId: 700, mediaType: 'movie', status: 3, title: 'Requested Movie', posterPath: '/p700.jpg', backdropPath: '/b700.jpg', overview: 'Requested.'}},
				{id: 2, status: 2, type: 'tv', media: {tmdbId: 701, mediaType: 'tv', status: 4, name: 'Requested Show', posterPath: '/p701.jpg', backdropPath: '/b701.jpg', overview: 'Requested.'}},
				{id: 3, status: 3, type: 'movie', media: {tmdbId: 702, mediaType: 'movie', status: 1, title: 'Declined Movie', posterPath: '/p702.jpg', backdropPath: '/b702.jpg', overview: 'Declined.'}}
			]});
			return json(route, {});
		}
		if (path.startsWith('/Moonfin/') ) return json(route, {});
		if (path === '/System/Info/Public') return json(route, {Id: 'srv1', ServerName: 'Mock', Version: '10.10.0', ProductName: 'Jellyfin Server'});
		if (/^\/Users\/[^/]+$/.test(path)) return json(route, {Id: 'u1', Name: 'tester', ServerId: 'srv1', Configuration: {}, Policy: {IsAdministrator: true}});
		if (path.startsWith('/Users/') && path.includes('/Views') || path === '/UserViews') return json(route, {Items: [], TotalRecordCount: 0});
		if (/Items|Shows|Persons|Genres|Studios|Artists|Playlists|Collections|Sessions/.test(path)) return json(route, {Items: [], TotalRecordCount: 0});
		return json(route, {});
	});
	await page.goto('http://127.0.0.1:8123/');
	await page.evaluate(() => {
		const set = (k, v) => localStorage.setItem('moonfin_' + k, JSON.stringify(v));
		set('jellyfin_servers', {srv1: {name: 'Mock', url: 'http://mock.test', serverType: 'jellyfin', addedDate: 1, users: {u1: {username: 'tester', accessToken: 'tok', connected: true, lastConnected: 1}}}});
		set('jellyfin_active_server', 'srv1');
		set('jellyfin_active_user', 'u1');
		set('seerr', {moonfin: true, url: 'http://seerr.test', jellyfinServerUrl: 'http://mock.test', jellyfinAccessToken: 'tok'});
	});
	await page.reload();
	await page.waitForTimeout(4000);
	return await page.title();
}
