# TODO

## Waiting on the user

- Nothing is waiting on a plugin: Moonbase 2.4.0.7 is Active on the server (checked 2026-10-27, `Moonfin/Tmdb/Thumb?...&size=w780` redirects to the 780 px picture), so the 1.7.x thumbs were already the smaller ones.
- Try 1.7.2 on the TV (see below) and send the diagnostic report taken right after scrolling a TMDB or IMDb row. Look at the 'Wide art summary' lines: `ready`/`late` (was the art held), `plain`, and `decodeAvgMs`/`decodeMaxMs` (how long the TV took to decode).

## 1.8.1: the lag in the 1.8.0 report

The 1.8.0 report showed `decodeAvgMs` 573 to 3122 (7136 at most) for the bitmap art, still slow with no Seerr lookups running, and up to 3.6 s for the lookups themselves. Bitmaps are removed (`decodeArt` decodes one picture at a time with `img.decode()`), and the TMDB rows skip the per-title lookups. Not tried on the TV. Open: the IMDb and custom rows still ask Seerr for each title at every start (about 20 per row); a cache kept across starts (`held` in `utils/localizeExternalItems.js` is per session) would remove them. Ask before doing it. If the next report still shows slow decodes, the cost is the TV's image decode itself: try fewer cards decoded ahead (`DECODE_AHEAD_RANK` 4 in `ModernMediaCard.js`) or none.

## 1.7.2: the picture on every row drew in from the top, held or not

The report from 1.7.0 showed the art held at all 75 focuses and the picture still drew in from the top; with 1.7.1 (wait for `img.decode()`) it was worse: the decode took 109 to 196 ms on average (731 at most) and the picture waited for that. The user turned the backdrop off and the Performance level to Performance and it still happened, so it is the TV's slow decode and paint, not the backdrop. 1.7.2 makes each nearby card's art a bitmap of the card's size ahead of time (`createImageBitmap`) and draws it on a canvas at focus; the decode wait is gone. Checked in a browser with the CPU slowed 6x (a canvas on every focus, about 20 ms), not on the TV. The summary line says how many cards drew a bitmap (`bitmap`) and how long making one took (`decodeAvgMs`, `decodeMaxMs`). If it still draws in: the raster of the focused card's layer (`will-change: transform` in `ModernMediaCard.module.less`) and the width transition are the next suspects.

## 1.7.2 too: backdrops of outside titles obey the blur setting

IMDb, TMDB and Seerr titles had a sharp backdrop beside the library's blurred ones at the Low and Medium Performance levels, since only a CSS filter (capped by the level) could blur them. They now use a small copy scaled up (`utils/softBackdrop.js`), whatever the level, under the existing Browsing Background Blur setting (Off, Light, Medium, Strong, Heavy). Not seen on the TV.

## Modern cards: the wide picture on external rows (1.7.0, confirmed on the TV only in part)

**Seen on the TV with 1.6.4:** the card grew at once, but about half the cards of the external rows (IMDb, TMDB, Seerr, upcoming) drew their landscape picture in from the top, i.e. the picture was downloading as the card was focused.

**Cause found:** the pictures fetched ahead were evicted from the TV's small image cache before the card came to use them. The Thumb route is also a 302 to image.tmdb.org at 1280 px (about 190 KB a picture, from the internet).

**Done in 1.7.0** (CLAUDE.md, "Where things are in the code", the Modern cards bullet):
- `components/MediaCard/artPrefetch.js` reads the pictures with `fetch` and holds them as blobs (24 MB, 150 pictures), so showing a card never depends on the TV's cache. Requests are shared between cards, run four at a time nearest card first, and time out after 15 s. CORS was checked on the real server: the 302, the 404 and image.tmdb.org all answer `Access-Control-Allow-Origin: *`. A picture or host that cannot be read this way is loaded the plain way for 5 minutes.
- A 404 from the plugin (an IMDb title with no TMDB id) sends the card to its backdrop at once, before it is focused.
- Cards ask the plugin for `size=w780` (Moonbase 2.4.0.7).
- The report gets 'Wide art not ready at focus', 'Wide art arrived late' and a 'Wide art summary' every 25 card focuses, with the kind (thumb, tmdb, library) and never the address.
- Tested in a browser on the real server with the image cache switched off and each wide picture slowed by 0.4 s: every card ready at a held key's pace and at about twice it, and no picture downloaded twice.

**Not known until the TV:** whether the held pictures plus the decode of a first show keep up with a held key on the Q67A, and how much memory 24 MB of blobs costs it. If it stutters, narrow `WARM_AHEAD` (8) in `components/MediaRow/warmWindow.js`, `MAX_ACTIVE` (4) or `MAX_BYTES` in `artPrefetch.js`. If cards still miss, the report says which kind and in what state (waiting, running, none).

## Upstream merge of 2026-10-27 (42 commits), decisions

- Backdrops: upstream's Home Screen Backdrop (Off, Full Screen, Corner) with the fork's soft blur for outside titles. Asked and answered.
- Person pages: upstream deleted `views/Person/Person.js`; the Popularity default and ranking are in `Details.js` and `NouveauDetailContent.js`. Asked and answered. The known-for backdrop of the old Person page is gone (`usePersonSeerrCredits` still computes it); ask before bringing it back.
- Next Up fix (#557) ported by hand into `useSegmentPopups.js`. Row sorting of the IMDb, TMDB and Seerr rows taken inside the fork's Home memory. Plex taken as it came.
- Open: on the Classic person page `usePersonSeerrCredits` runs twice for the same person (one extra Seerr request); pass `appearances` and `crewCredits` down from `Details.js` if that matters. Not tried on the TV: Plex, the Corner backdrop, the Next Up countdown.

## Open from the code reviews

- A 5xx answer for a thumb sends the card to the plain image path, and only a 404 (or a plain load that fails) hands the card to its backdrop.
- One focused row is a module level value shared by every screen (Search, Seerr Discover, the hidden Home).
- The Browse change (every row kind tells the focused row) has no unit test, since Browse is too heavy to mount.
- The IMDb row that "did not work" (1.6.3): the live order has it right after the Seerr tile rows, which is the case the 1.6.3 fix covers. Not reproduced otherwise.

## Upstream merge of 2026-10-26 (24 commits), decisions

- Person pages: Popularity (with grouped roles) is the default. Entry 16 of CLAUDE.md. Asked and answered.
- Details tab bar: upstream's, with the fork's `compact` and `entryFromAbove`. Entry 17. Asked and answered.
- The skip prompt stays the fork's own (entry 6); upstream's Up and Down to the pre-roll skip buttons (`useCinemaSkip`) is taken.
- The Media Preview setting is upstream's new Off / Media Preview / Trailer Preview choice.
