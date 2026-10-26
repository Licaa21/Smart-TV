# TODO

## Modern cards: wide picture not instant on external rows (open, from 1.6.4)

**What is seen on the TV (Q67A, 1.6.4).** The card grows at once. About 40 to 50% of the cards of the external rows
(IMDb, TMDB, Seerr, upcoming) show their landscape picture straight away. The rest of the same rows show the picture
arriving top to bottom, like a loading sweep. That is not an animation: it is the picture (a JPEG) being drawn while it is
still downloading, so those cards were **not in the cache** when focus landed on them. Library rows and "Since you
watched" are fine.

**What 1.6.4 does** (see CLAUDE.md, "Where things are in the code", the Modern cards bullet):
`components/MediaCard/artPrefetch.js` fetches the wide art four at a time, nearest card first, 8 cards ahead in the
focused row, the first 5 of the row above and below (and the card a row will be entered on). The rank moves with focus,
a card leaving the window drops its fetch. `components/MediaRow/warmWindow.js` has the window (`warmRank`,
`useWarmRow`), `Browse.js` tells the focused row for every row kind, `ModernMediaCard.js` has the card side.

**Why some cards may still miss (not found yet, in the order I would check):**
1. A fetch that was **dropped or never started**. A card leaving the window cancels its request, and only four run at
   a time, so on a held key the cards that should have been fetched were still waiting or cancelled. A request that never
   answers holds one of the four places until its card leaves the window (no timeout).
2. The **picture is fetched but not reused**: the `Image()` that prefetches and the `<img>` of the overlay must ask for
   the same URL and the HTTP cache must keep it. Plugin thumbs answer `Cache-Control: public, max-age=31919000` with a
   `Last-Modified`, which is cacheable. TMDB `w780` backdrops come from image.tmdb.org (over http on webOS and legacy
   Tizen) and were not checked. Check the real request log on the TV for the same URL being asked twice.
3. **Size and decode:** plugin thumbs are about 130 to 340 KB each (190 KB on average), library art about 40 KB. On the TV
   a full thumb takes longer than the 8 card lead of a held key (108 ms a card) when the network is slow, and a baseline
   JPEG draws top to bottom while it arrives.
4. The titles with only an IMDb id: the plugin has no thumb (404) and about 5% have no backdrop either, so they can only
   show the poster in the wide frame. This is handled (failed thumbs are remembered for 5 minutes) but a card that is
   asked before it is known to have failed still waits for the 404.
5. Rows far down the Home list: `mountedRows` and the gradual drawing may leave a neighbouring row without cards when
   focus reaches it.

**To find out which one it is (do this before changing more):**
- Add a diagnostics line to the report (the app already has a ring, `moonfin_diag_ring`, and `watchArrowHolds` for the
  keys): for each card focus on a Modern row, whether its wide art was already loaded (`hasArt`), whether its prefetch
  was waiting, running, finished or cancelled, and the URL host and type (thumb, TMDB backdrop, library). Then a report
  says which cards miss and why, with no guessing.
- Ask for a report taken right after scrolling a TMDB or IMDb row on the TV.

**Ideas, if the misses are cache misses:**
- Fetch the art as a **Blob** (`fetch` then `URL.createObjectURL`) and give the overlay that URL, so showing a card never
  depends on the HTTP cache. It needs CORS on the image hosts (check the plugin thumb route and image.tmdb.org), keeps
  memory (about 200 pictures of 200 KB), and the object URLs have to be revoked.
- Decode ahead with `Image.decode()` for the 3 nearest cards only (it was dropped from the prefetch to save CPU).
- Ask the plugin for a **smaller thumb** (a `width` parameter on `Moonfin/Tmdb/Thumb`, the plugin fork is in
  `E:\VSCode Projects\Moonfin Plugin Fork`, another chat works there; ask first). The card needs about 520 px.
- Raise or lower `WARM_AHEAD` (8) and `MAX_ACTIVE` (4) in `warmWindow.js` and `artPrefetch.js` by what the report says.

## Left open from the last code review (1.6.4)

- A request that never answers holds one of the four places: add a timeout (about 8 s) that drops it.
- A one-off plugin failure hides a title's thumb for 5 minutes: only remember a failure that looks like "none"
  (a 404), which needs the status, so fetch instead of `Image()`, or shorten the time.
- Cards of the same title already mounted do not hear of a failed thumb until they render again.
- A card that is focused while its prefetch still waits asks twice for the art (the overlay `<img>` and the queue): cancel
  the prefetch of a card once it is focused.
- The focused row is a module level value shared by every screen (Search, Seerr Discover, the hidden Home).
- The Browse change (every row kind tells the focused row) has no unit test, since Browse is too heavy to mount.
- 8 cards ahead and 4 at a time are not tried under load on the Q67A.

## Not mine to decide, waiting on the user

- Whether the Rate button is the star or the thumb: the Rate commits on `implement` went star, then thumb (`e0dcf88a`,
  in 1.6.2), and entry 15 of CLAUDE.md says "the thumb". Confirm that is what is wanted.
- IMDb row that "did not work" (1.6.3 report): not reproduced. Needs where that row sits in the real Home order and
  whether it is the first card, later cards, or all of them.
