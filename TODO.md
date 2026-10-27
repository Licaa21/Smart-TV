# TODO

## Waiting on the user

- **Restart Jellyfin.** Moonbase 2.4.0.7 (the thumb takes `size=w300|w780|w1280`) is installed on the server and waits for a restart: the install was accepted (204) on 2026-10-26, but the restart was blocked by the permission classifier, so it was not done. Until it is restarted, 2.4.0.6 stays active and the TV's `&size=w780` is ignored (nothing breaks, the thumbs are just the 1280 px ones). After the restart: check `/Plugins` shows 2.4.0.7 and that `Moonfin/Tmdb/Thumb?...&size=w780` redirects to `.../t/p/w780/...`.
- Try 1.7.1 on the TV (see below) and send the diagnostic report taken right after scrolling a TMDB or IMDb row. Look at the 'Wide art summary' lines: `ready`/`late` (was the art held), `plain`, and `decodeAvgMs`/`decodeMaxMs` (how long the TV took to decode).

## 1.7.1: the picture drew in from the top on every row, even held

The report from 1.7.0 (2026-10-27) showed the wide art held at all 75 card focuses (library 14, thumb 61, none late), and the user still saw the picture draw in from the top, on all rows. So it is the TV decoding and painting it, not a download. 1.7.1 decodes the nearest cards' art ahead (`decodeArt`) and shows a card's art only once `img.decode()` has finished (400 ms at most). Checked in a browser with the CPU slowed 6x (the art shows 40 to 100 ms after the key); not known on the TV. If it still draws in, the summary's `decodeMaxMs` says whether decoding is the slow part; the next suspects are the size of the picture (Moonbase 2.4.0.7's `size=w780` is not active until Jellyfin restarts), the raster of the focused card's own layer (`will-change: transform` in `ModernMediaCard.module.less`) and the width transition on the card.

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
