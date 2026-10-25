# Moonfin Smart TV fork (Lica)

This folder is the **implement** branch.

## Read this first

Personal fork of Moonfin for Smart TVs (Tizen and webOS; an Enact/React app). Upstream is Moonfin-Client/Smart-TV
(RadicalMuffinMan and the Moonfin contributors). The fork is Licaa21/Smart-TV and holds changes for one person's daily
use. It is not a project for everyone. Three changes are proposed upstream: the in-player episode browser (pull request #494), a fix for Home cards that opened nothing after playback (#534, merged upstream on 2026-10-15, its folder is gone) and the skip prompt over the player controls (#535, merged upstream on 2026-10-16 in the maintainer's rewrite, see entry 6 of "Upstream changes that are not taken"). Remotes: `origin` is the fork, `upstream` is Moonfin-Client/Smart-TV.

The rules that matter most, each explained further down:

1. **Ask before every change.** Questions come first, with options and a recommendation. See "Working rules".
2. **Before any coding on `implement`, bring upstream into `daily` first, and only then `daily` into `implement`.** Never pull from `daily` alone, since it may be behind upstream. The steps are in step 0 of "How changes flow".
3. **Never commit to `main` or `daily`**, except the README and ignore rules on `main` and the upstream merges of step 0 (merge commits and conflict fixes). Work goes on `implement`.
4. **Build only in `daily/`**, with `bash fork-tools/build-daily-wgt.sh`.
5. **A change is done only when** lint and tests are clean, the code review found nothing real, every string has a
   Romanian one, and this file and the README are up to date.
6. **After every merge from upstream**, run the merge checklist, and keep what is in "Upstream changes that are not
   taken".
7. **Commits carry no AI names**: authored as Licaa21, no co-author or generated-with lines.
8. **The code review is never skipped.** Every change to code, settings, defaults or scripts is reviewed before it is reported as done, at least two passes, and a merge from upstream is reviewed too (the conflict resolutions especially). Small changes are not exempt, and neither is a change that passed its tests. Only a change to CLAUDE.md, the README or other prose alone is. The report names the passes and what each found, and a report without them is not finished. Do not write "I did not run the code review" as a way out: run it. This rule was added after a session skipped it for most of its work.

## Repository layout

`E:\VSCode Projects\Moonfin Smart TV fork` holds one folder per branch. They are git worktrees of one repository whose
`.git` is inside `main/`.

| Folder | Branch | Used for |
|---|---|---|
| `main/` | `main` | Follows upstream, plus the fork README and ignore rules. Holds the shared `node_modules` |
| `implement/` | `implement` | Where all the fork's own changes are written and committed |
| `daily/` | `daily` | `main` merged with `implement`. Only used to build the app |
| `pr-episode-browser/` | `feature/episodeselector-skipperlayout-accentcolors` | Pull request #494 upstream |
| `pr-skip-prompt-over-controls/` | `feature/skip-prompt-over-controls` | Pull request #535 upstream, merged. The folder can go when the user says so |
| `local/` | none | Not a branch: backups (`*.bundle`), logs, photos, notes |

This file is committed on `implement` and is the copy to edit. `update-daily.sh` brings it into `daily` with the rest of `implement`, and the copies in `main/` and `pr-episode-browser/` are local and untracked, so a change to it is made in all four folders (only line 3 differs, and after a merge into `daily` line 3 has to be put back to say daily). The folder for #535 has none.

### Shared dependencies

`node_modules` and `tools/node_modules` in every folder other than `main/` are links to the ones in `main/`
(`fork-tools/link-modules.ps1`). `packages/app/node_modules` is a real folder per branch, because the webpack cache
inside it must not be shared: a shared cache served stale file lists and the dev server reported modules missing that
were on disk. `@moonfin/platform-*` resolve to `main/packages`, so edits to platform packages in `implement` or `daily`
are not built. App-level code is.

- To add a branch folder: `git worktree add ../<folder> <branch>` from `main/`, then
  `powershell -File implement/fork-tools/link-modules.ps1 -Folder <folder>`. If the script prints a path error (it did for #534 and #535, whose folders were made by hand), make the two junctions by hand: `cmd /c mklink /J <folder>
ode_modules <main>
ode_modules` and the same for `tools
ode_modules`.
- To remove one: unlink the two `node_modules` links first (`cmd /c rmdir` on each link, which removes the link and not
  what it points to), then `git worktree remove <folder>`. Skipping the unlinking makes the delete follow the links and
  empty the shared dependencies, which has happened once.
- If the folders are ever moved, `git worktree repair <paths>` from `main/` fixes the links.

## How changes flow

0. Before any coding on `implement`: bring upstream into `daily` first, then `daily` into `implement`. Never pull from `daily` alone, since it may be behind upstream. In `main/`, `git fetch upstream` and `git merge upstream/main`; in `daily/`, merge `main` into it (`bash fork-tools/update-daily.sh` does both and also merges `implement`), solve the conflicts there, ask the user when something needs their idea, run the merge checklist below (with its code review of the conflict resolutions) when upstream brought something new, and push. Only then, in `implement/`, `git fetch origin` and `git merge origin/daily` (a fast-forward when `implement` has nothing new, a merge when it does), so the work starts on what upstream added and on every conflict already fixed. Do it again at the start of each piece of work, not once. When upstream has nothing new, `daily` is already current and the pull is a fast-forward.
1. Upstream moves. `main` takes it (`git merge upstream/main`, never rewritten).
2. The fork's changes are committed on `implement`, in `implement/`. Never on `daily`, never on `main` (apart from the
   README and ignore rules).
3. `daily` is only ever updated by merging. `bash fork-tools/update-daily.sh`, run in `daily/`, merges upstream into
   `main`, then `main` and `implement` into `daily`, regenerates the accent rules and pushes. Push `implement` first,
   since the script merges `origin/implement`.
4. A merge conflict is fixed in `daily` and committed there. Then `implement` is fast-forwarded to `daily`
   (`git merge --ff-only origin/daily` in `implement/`, then push), so the resolution is not redone.
5. The app is built from `daily` only (see "Packages").
6. The pull request branch is separate and based on upstream. Anything proposed upstream is made there, from upstream
   main, with only that feature in it. It is carried into `implement` by hand, since the two histories differ.

`implement` does not need to merge `main`. When it does, it is to take a README or ignore change.

### Merge checklist (after every merge from upstream)

1. Read what upstream added (`git log --no-merges <old>..upstream/main`) and tell the user what is new.
2. Fix conflicts in `daily`. Keep the fork's version of everything in "Upstream changes that are not taken", and say so.
3. `node scripts/gen-accent-rules.js` (the update script does it; `--check` fails when the file is stale). When `package.json` or `packages/app/package.json` gained a dependency, run `npm install` in `main/` too, since every folder shares its `node_modules` (the 2026-10-22 merge brought epubjs, pdfjs-dist and libarchive.js, and the build stopped on "Book reader asset missing" until it was run).
4. `node fork-tools/check-romanian.js` from the repository root. It must print "Every string has a Romanian one". Translate
   what it lists by hand (see "Strings").
5. From `packages/app`: `npx enact lint .` and `CI=true npx enact test --watchAll=false`. Both clean.
6. Update the README on `main` when something the user can see changed, and add anything newly not taken to the list below.
7. Fast-forward `implement` to `daily` and push. Build only when the user wants a package.

## Working rules

### Asking and deciding

- Ask before every modification, fix or addition, and on anything that needs the user's idea or taste (what a screen
  should show, how something should behave, which of several ways to go). Put the question first, with the options and a
  recommendation, and wait for the answer before changing code. Clear bugs with only one sensible fix are the
  exception, but say what was done.
- Code first, small changes, no speculative extras. Match the surrounding code's style and keep comments in its voice.
- To check how a feature works, or whether it exists (whether the user added it or upstream did), find the exact commit
  that added it (`git log -S`, `git log --grep`, `git blame`) and read that commit, rather than judging from the
  current code or from memory.

### Checking a change

- From `packages/app`: `CI=true npx enact test --watchAll=false` and `npx enact lint .`. Both must be clean. One test,
  `src/services/xboxNativeVideo.test.js`, already fails on the fork's branches and is not caused by a change. A test run
  in a folder without `node_modules` fails with "enact is not installed": link the modules first.
- After every fix, feature or addition, and after every merge from upstream, run the code review (`/code-review`, or a read-only review agent given the diff
  and the context) on the change, and run it more than once: fix what it finds, then review again, until a pass finds
  nothing real. Do this before reporting the work as done, before committing when the commit is what gets built, and before a build. It is part of the work, not an extra to offer afterwards: if it was not run, the work is not done. The order before every report: lint, tests, code review (two passes or more), `verification-before-completion`.
- Every change ships with a test for what can be tested (rules, ranking, timing with fake timers, a hook with Spotlight mocked), added in the same commit. What needs a real TV (focus feel, timing on the set) is said so in the report instead.
- Look at screens in a browser, not just in tests (see "Tools"). TV behaviour itself is only known from a real TV.
- Do not run the tests while the dev server is up: the server stalls rebuilding. Stop it first.

### Strings and languages

- New English strings go in `packages/app/resources/strings.json` in code-point order. Strings the code asks for with
  `$L('...')` must be listed there, or no language has them.
- Romanian is translated by hand in `packages/app/resources/ro/strings.json` (4-space indent, same order). The fork has
  no Weblate. Other locales are left alone.
- Every string needs a Romanian one: run `node fork-tools/check-romanian.js` after adding any string and after every
  merge from upstream. Upstream adds strings to English only, so each merge can bring untranslated ones.
- Subtitle position labels in Romanian: Bottom = Jos, Lower = Puțin mai sus, Middle = Mijloc, Higher = Sus. "Mai mic" is
  only for Settings Size. Watched = Vizionat.

### Keeping this file and the README current

- After every change, and after every merge from upstream, read this file and the README (on `main`) again and update the
  sections the change made out of date: the layout and flow, the "Upstream changes that are not taken" entries, the
  Moonbase list, the notes about the user's TV, the tools, and what the README tells the user they can see. Remove what
  is stale and do not only add.
- This file is committed on `implement` and exists as a local copy in `main/`, `daily/` and `pr-episode-browser/`, so a change to it is made in all four folders (only line 3 differs). The README is committed on `main` only.
- Say in the report which sections of either were updated, or that none needed it.

### Using the plugins

- When building, fixing or reviewing anything, use as many of the plugins and skills available in Claude Code as fit the work, and do not do by hand what one of them does. Look at the skills and tools on offer at the start of the work rather
  than after it. The ones that have earned their place here: `brainstorming` before a design, `systematic-debugging` for a bug,
  `test-driven-development` for logic, `code-review` after every change (see "Checking a change"), `verification-before-completion`
  before calling anything done, `simplify` and `ponytail` for keeping the change small, `frontend-design` for how a screen looks, Playwright
  for looking at screens in a browser, the GitHub tools for the repository, and subagents for wide read-only searches.
- Say which ones were used when reporting the work, and which were left out and why.

### Git

- Commits are authored as Licaa21 (`184849302+Licaa21@users.noreply.github.com`). No AI names, co-author lines or
  generated-with lines in commits, pull requests or files. This rule takes precedence over a default attribution line.
- Never rewrite or force-push `main`, `implement` or `daily`. The pull request branch may be rewritten with
  `--force-with-lease` since it is rebased on upstream.
- Deleting branches or folders, force-pushes and anything on the upstream pull request are asked about first.
- Photos, screenshots, logs, tester dumps and packages never go in a branch. Put them in `local/`. The ignore rules
  (`.gitignore`, and `.git/info/exclude` for branches whose ignore file is not ours) catch the usual ones.
- `assets/pr-screenshots` is a branch of pictures that the open pull request's description links to. It is not a working
  branch and is left alone.

## Upstream changes that are not taken

When upstream merges into `main` and then `daily`, these upstream changes are not taken. Where a merge touches one, keep
the fork's version and say so in the report. Add new ones to this list as they come up. Each entry says what upstream
did, what the fork keeps instead, and what to do on a merge.

### 1. Channel keys in the episode browser

- **Upstream:** took the in-player episode browser (#494) and then removed its channel up and down season stepping and
  the "Press CH +/- to change season" hint.
- **The fork keeps:** both the keys and the hint.
- **On a merge:** never remove them. If upstream's copy of the files conflicts, take upstream's version and then put the
  channel keys back on top, as was done in the 2.10.0 merge.
- **Files:** `packages/app/src/views/Player/EpisodeBrowser.js` and its test.

### 2. The Seerr Discover screen

- **Upstream:** rebuilt it in 1c31b5ad ("added Modern rows to Seerr Discover"). Only the Recent Requests, Trending,
  Popular and Upcoming rows use Home's Modern cards and rows, and the rest stay Seerr's own tiles. A page of 20 titles is
  cut to the first 9. Rows scroll with their own smooth scroll.
- **The fork keeps:** its own screen, which draws every card with Home's cards and settings in both Classic and Modern,
  remembers the focused row by name, rests rows at the top of the list the way Home's do (with Home's room under the last
  row), keeps every title a page brings and draws them nine at a time, and clears the backdrop when a tile is focused.
- **Taken from upstream into it:** the request status on a request card, one card per request, and the titled TMDB thumb
  (that one lives in the card components).
- **On a merge:** keep the fork's two files whole and never take upstream's version of them. Upstream's
  `SeerrDiscover.test.js` tests its own structure and is not kept.
- **Files:** `packages/app/src/views/SeerrDiscover/SeerrDiscover.js` and `SeerrDiscover.module.less`.

### 3. Studio and network tiles, and backdrops behind tiles

- **Upstream:** draws the studio and network logos as they are on the dark surface, where the dark ones cannot be read.
  A focused shortcut or genre tile puts its own tile art behind the screen as a backdrop, and on the Seerr screen the
  studio, network and shortcut tiles leave the previous card's picture behind. The Seerr screen draws its logos all white.
- **The fork keeps:** one shared `LogoTile` (`components/LogoTile`) for the logos on Home and on the Seerr screen: a grey
  tile (a light one glared on the TV), the logo in its own colors when they contrast enough with the tile or it is white
  already, and a dark logo drawn white (`utils/logoTone.js` reads a 24x24 probe of the picture; a picture that cannot be read
  is drawn white), never dimmed when not focused. No backdrop behind a shortcut, genre, studio or network tile on Home or on
  the Seerr screens, and `BackdropLayer.js` drops a picture still loading for a card focus has left.
- **On a merge:** keep `LogoTile` as the only logo tile (Home's `SeerrTileRow.js` and the Seerr screen both use it, so the
  two cannot drift apart) and the `isSeerrTile` check in the backdrop code.
- **Files:** `components/LogoTile/`, `utils/logoTone.js`, `components/SeerrTileRow/SeerrTileRow.js`,
  `views/SeerrDiscover/SeerrDiscover.js`, `components/ScreenBackdrop/ScreenBackdrop.js`, `utils/seerrHomeRows.js`
  (`isSeerrTile`) and `views/Browse/Browse.js`.

### 4. Home kept on a return

- **Upstream:** Home is built again every time it is returned to from a title. With favorites, collections, genres,
  playlist, recommendation or plugin rows on (or unified mode) it loads everything again behind a loading screen, in
  waves, and starts on the media bar. Its Seerr and outside list rows are fetched again and come back late and reshuffled,
  Continue Watching and Next Up are fetched again, and the restore effect leaves a timer per run, so when rows arrive the
  second run finds no place to return to and focuses the banner or the row above.
- **The fork keeps:** the whole screen, taken back in the first frame with nothing loaded, on the row and card that were
  left: `memoryCache.screen` (rows and media bar, with its owner and a signature of the settings the rows were loaded for)
  is the reducer's starting state, the load effect skips its first run, and a layout effect in `Browse.js` restores the
  scroll and focus by row name before the first paint. Drawing every kept row at once held Back up for seconds on the TV,
  so a return draws only the landing row and its neighbours, holds the other rows' places at the heights recorded when
  focus left (`lastFocusState.heights`, `fillStep` in `Browse.js`), and fills them in a few at a time; the rows other
  than the landing one forget their drawn card counts (`forgetRowCountsExcept`). The Seerr and outside list rows come from memory too
  (`memoryCache.seerrRows` and `externalRows`). The older timer effect stays as the fallback when something is missing.
- **Dropped by:** a visit of its own (no place to return to), a refresh, an account change, a library hidden or
  ordered or a media bar change (`moonfin:browseRefresh` with `libraries` or `featured`), a favorite, a playlist change or
  a delete (`moonfin:homeRowsChanged`, sent from `services/jellyfinApi.js` and Details), and a Seerr request or watchlist
  change (`moonfin:seerrChanged`). Continue Watching and Next Up are refreshed on a return only when something was played
  or marked watched while away (`memoryCache.volatileStale`).
- **On a merge:** keep all of it: the `reuse` parameter and kept-screen start in `useBrowseData.js`, the save effect, the
  signature (add any new setting the loaders read to `loadSignatureOf` and to the load effect's dependencies), the layout
  effect and the one `restoreTimerRef` in `Browse.js`, the `reuse` and `owner` parameters of the two row hooks, and the
  memory keys and listeners in `browseCache.js`.
- **Upstream later kept Home mounted** (`HomeLayer` in `App.js`, hidden under other screens, released at sign in and during playback), so Back from a title no longer rebuilds it. The fork takes that layer and keeps everything above for the times Home is built again (after playback and sign in). In `Browse.js` the fork's own restore (`returning` layout effect, `restoreTimerRef`, `lastFocusState.heights`) stays and upstream's `returnRow` is left out. Upstream's row scroll memory for a hidden Home is kept, as is `rowToRestore` (unused by Browse). The layer's `Browse` carries the fork's `onUnfocusItemThemeMusic`.
- **Upstream later mounts Home's rows gradually** (`mountedRows`, `FIRST_ROWS`, `ROWS_AHEAD`, `deferImages`, `settleRow`, and focus callbacks that read their values through `liveRef` because rows keep the ones they mounted with). The fork takes it all. On a return `mountedRows` starts at Infinity, so the fork's own fill (`filling`, `fillStep`, held row heights) is checked first in the row loop and still draws only the landing row and its neighbours. `handleFocusItem` is upstream's stable callback carrying the fork's theme music rule and Modern rows backdrop feed, and `onUnfocusItemThemeMusic` is in `liveRef`. Moving down from the media bar takes upstream's immediate focus with the fork's `rowEntryCardIndex`.
- **Files:** `views/Browse/Browse.js`, `useBrowseData.js`, `useSeerrRows.js`, `useExternalRows.js`, `browseCache.js`,
  `services/seerrApi.js` (request helper) and `services/jellyfinApi.js` (`homeRowsChanged`).

### 5. The language of the TMDB and list rows

- **Upstream:** 5f6e6d7e asks the plugin for the TMDB, IMDb and custom list rows in the app's interface language (`settings.uiLanguage`) and keeps the rows cached per language and per account (`services/externalRowsApi.js`).
- **The fork keeps:** the language the Jellyfin server is set to for metadata (`currentMetadataLanguage()`) as the language those two calls are given in `views/Browse/useExternalRows.js`, and its own client side pass over what comes back (`localizeSeerrCards` for the rows, `localizeExternalItems` for the seasonal row), since a plugin without the support, 2.4.0, ignores the parameter.
- **On a merge:** take upstream's `externalRowsApi.js` and its tests whole, which was done in the merge that brought this in, and keep `{language}`, the metadata language, in the two calls in `useExternalRows.js`.
- **Files:** `views/Browse/useExternalRows.js`, `utils/localizeExternalItems.js`.

### 6. The skip prompt

- **Upstream:** took the skip prompt over the controls (#535) and rewrote it ("match Core's skip prompt"): it is offered on the way into a segment, held back after a viewer's seek until a Tizen seek lands (`suppressSeekPrompts`, `noteSeek`), kept with the controls once its time runs out, dismissed first by Back, and placed above the measured controls bar (`data-player-controls-bottom`). Its hook returns `skipPromptShown` and takes `onFocusSeekbar`.
- **The fork keeps:** its own prompt: seek re-offer by watching the position (a jump forward over 3 s or back over 1 s offers the non-automatic segments again, and a skip that lands short is not re-offered for 5 s), the next up card coming back, the channel list button (CH label, centre of the rocker) bringing the prompt back, Down from the prompt returning to the playback bar (`onLeavePromptDown`), the prompt editor and look (`skipOverlayLook.js`), and the lift above the controls measured with `promptBottomFor`.
- **Taken from upstream around it:** the `data-player-controls-bottom` and `data-player-controls-row` marks on the controls, `useChannelKeys` (CH +/- jump chapters, then episodes, and change channels on live TV) and the held scrub in the players. The fork's far seek on CH +/- (five times the step) is gone, since a held left or right now speeds up.
- **On a merge:** keep the fork's `useSegmentPopups.js` (with its tests), `SkipSegmentOverlay.js` and `skipOverlayLook.js` whole, and keep in them the exports the players call, `isSkipPromptFocused` and a `suppressSeekPrompts` that does nothing (the players' seeks call it). In `TizenPlayer.js` and `WebOSPlayer.js` keep the fork's arguments to the hook (`focusRow`, `onLeavePromptDown`), `skipSegment` in the render check and `measureKey` on the overlay.
- **Files:** `views/Player/useSegmentPopups.js`, `SkipSegmentOverlay.js`, `skipOverlayLook.js`, `TizenPlayer.js`, `WebOSPlayer.js`.

### 7. Held arrows and the dotted i

- **Upstream:** first dropped any repeat of a held arrow whose event stamp was more than 100 ms old (`dropStaleArrowRepeats`, #320). On the user's Q67A that dropped every repeat of a hold, since the set sends a repeat every 108 ms (350 ms before the first) but stamps each one 100 to 400 ms old (27 of 28 key downs in the 2026-10-17 report). Since 87594315 (2026-10-21) it is `paceArrowKeys`, which drops a repeat only while the previous move has not been drawn yet (a frame and a message), with no use of the stamp, and lets one through after a second so a page that stops drawing cannot hold the arrows.
- **The fork keeps:** upstream's `paceArrowKeys` as it is (the fork's own rule, dropping a repeat that came less than 40 ms after the last, was given up for it on 2026-10-21), and its own `watchArrowHolds` (`utils/keys.js`), registered before the pacing in `index.js`, which logs each hold of over 600 ms ("Arrow held" in the report: key downs, flagged repeats, gaps), so a report says what the set sent. Tizen never sets `repeat`, so a held key is told by the key code staying down. Not yet tried on the TV when this was written. The page also switches off the common ligatures (`font-variant-ligatures: no-common-ligatures` in `App.module.less`), since the font's fi glyph took the dot of the first i in "fii" and "fiica".
- **On a merge:** take upstream's pacing whole, and keep `watchArrowHolds` with its call in `index.js` and `keys.repeat.test.js` (its tests), and the ligature line. Upstream's patch to Spotlight's Accelerator (`scripts/patch-enact-legacy.js`, patch 17) is taken as it is.
- **Files:** `utils/keys.js`, `index.js`, `App/App.module.less`.

### 8. The Library's sort and filter panel

- **Upstream:** 7d9d9e0e added the Classic, Modern and Docked library styles (`views/Library/LibraryHeaders.js`, the `libraryStyle` setting), and the Sort & Filter side panel with its accordion of groups stays upstream's own.
- **The fork keeps:** the three styles as upstream has them, but every sort and filter button in all of them (Sort, Show, and the Classic toolbar's) opens the shared `FilterPopup`, not the panel. Show opens it on Played Status (`popupGroup`), the others on Sort By. Group By and Display still open the settings panel, on their own rows. The library page has no Refresh button, in any style. The default style is upstream's (Classic).
- **On a merge:** keep `FilterPopup` and its groups in `Library.js`, the `popupGroup` state, `sortButtonId` and `settingsButtonId` on `useSortSettingsPanels`, and upstream's `LibraryHeaders.js` and style code as they come. Upstream's `expandedSection`, `handleSectionExpand` and `sortFocusId` are the old panel's and stay out. Modern cards: keep the fork's `rowArtwork` (the row's artwork choice) passed into upstream's `cardImageUrl`, with the Seerr titled thumb still ahead of it.
- **Files:** `views/Library/Library.js`, `components/FilterPopup/`, `hooks/useSortSettingsPanels.js`, `components/MediaCard/ModernMediaCard.js`.

### 9. The update check

- **Upstream:** `services/versionChecker.js` compares Moonfin's own version (`package.json`) with the newest release of Moonfin-Client/Smart-TV that carries a package for the platform.
- **The fork keeps:** the same check pointed at the fork's own releases (`Licaa21/Smart-TV`, tags `fork-v<x.y.z>`), against the fork's version, which `build-daily-wgt.sh` works out before compiling (`publish-wgt.sh --version`) and stamps into the app as `REACT_APP_FORK_VERSION` (without it, in the dev server, Moonfin's version stands in and nothing is offered). Settings shows it after Moonfin's (`getDisplayVersion`), and the Check for Updates row closes Settings, opens the update panel over Home with the release's description as the changelog, and OK or Back on the panel opens Settings again on that row (`moonfin:showUpdate`, handled in `App.js` with `reopenSettingsRef`; a check the viewer asked for ignores a dismissed notice). The panel takes focus back whenever something behind it takes it (Home's media bar does when its slides arrive), so Back and OK reach the panel only (`UpdateNotification.js`). The launch check asks at every start, with no cooldown (`CHECK_COOLDOWN_HOURS = 0`), since a 24 hour one hid the update from a package that had just been installed.
- **On a merge:** keep the fork's repository URL, the tag prefix and `APP_VERSION` in `versionChecker.js`, the `getDisplayVersion` use in Settings, and the event.
- **Files:** `services/versionChecker.js` (and its test), `views/Settings/Settings.js`, `settingsSchema.js`, `App/App.js`, `fork-tools/build-daily-wgt.sh`, `fork-tools/publish-wgt.sh`.

### 10. Lazy viewers, the audio start and the episode band

- **Upstream:** imports the photo viewer, the comic viewer and the settings panel directly in `App.js`, and since 9683ffdc the EPUB and PDF readers too (`BOOK_READERS`). Its Transcode Audio Codecs setting (8c6b1be9) renews the track by `transcodesAudioCodec` in `TizenPlayer.js`. The blue band around the episode being viewed in Details is 0.7 border and 0.08 fill.
- **The fork keeps:** every one of those viewers and readers loaded only when opened (`lazy`, and the reader drawn inside a `Suspense`), its own audio start decision (`audioStartNeedsServer`, `openingAudioStream`) with the Transcode Audio Codecs test added to the same condition, so the setting acts at the start of a film too, and the stronger band (0.9 border, 0.18 fill) in `Details.module.less`. These were asked about and answered in the 2026-10-22 merge.
- **On a merge:** keep `lazy` for any viewer or reader upstream imports directly, the fork's audio start block with upstream's codec test inside it, and the stronger band.
- **Files:** `App/App.js`, `views/Player/TizenPlayer.js`, `views/Details/Details.module.less`.

### 11. Trailer quality, the Player signature and the Settings rows

- **Upstream:** `youtubeTrailer.js` follows a Fire TV trailer's separate soundtrack (`followSoundtrack`, `attachVideoOnly`) and leaves hls.js to its own quality choice. The WebOS player has no `startPaused`. Settings shows the three backdrop switches (Home Screen, Details Screen, Library Backdrops, since e97f2450) in place of the one.
- **The fork keeps:** `pickTrailerLevel` (one quality per trailer, so the sound stays with the picture) next to upstream's soundtrack follower, the `startPaused` prop and the Back-from-player pause it serves, the Settings Size row (upstream moved the three backdrop switches out of Appearance > Display into Home Screen > Looks, Details Page > Display and Libraries > Library View, and the fork takes that), and Seerr cards opening through `seerrCardTarget` before upstream's Default Action (`autoPlay`) is applied in `handleSelectItem` (`App.js`, `Browse.js`). Upstream's rebuilt playback information dialog (`PlaybackInfoModal`) is taken whole, and the old info styles and helpers in the players are gone with it.
- **On a merge:** keep those, and keep the fork's own screens that read `showHomeBackdrop` through `ScreenBackdrop` (Seerr Discover and the Seerr browse screens follow the Home Screen switch, not the Library one).
- **Files:** `services/youtubeTrailer.js`, `views/Player/WebOSPlayer.js`, `views/Settings/settingsSchema.js`, `App/App.js`, `views/Browse/Browse.js`.

## The plugin fork, and the TMDB text

The Moonbase plugin has a fork of its own, Licaa21/Plugin, in `E:\VSCode Projects\Moonfin Plugin Fork` (`main/`, `implement/`, `local/`, with its own CLAUDE.md in `implement/`; another chat works there). Its releases are installed on the Jellyfin server from the fork's manifest, `https://raw.githubusercontent.com/Licaa21/Plugin/refs/heads/main/manifest.json`; 2.4.0.1 was installed on 2026-10-25 over upstream's Moonbase 2.4.0.0 (same id, the configuration was kept), and 2.4.0.3 (the settings the app syncs, 102 typed fields) the same day. Its releases from 2.4.0.4 on bundle upstream's Moonfin web app (the `frontend/` folder of upstream's zip, about 66 MB); 2.4.0.1 to 2.4.0.3 did not, which left the Moonfin button in Jellyfin web at a 404 until the files were copied into the installed plugin folder by hand on 2026-10-25.

**The app has no TMDB key of its own.** It asks the plugin, which holds the server-wide key: `services/tmdbProxy.js` calls `Moonfin/Tmdb/Details`, `Season` and `Recommendations` (and the existing `NextEpisode`), which answer in TMDB's own shapes (the contract is in the plugin's CLAUDE.md, section "What the TV client expects"). `tmdbGet(path, language)` there turns a TMDB path into the route. The callers are `utils/seerrTitle.js` (a Seerr title's words), `utils/seerrSeasons.js` (a season's episodes), `services/homeRecommendations.js` (the online recommendations) and `utils/upcomingEpisode.js` (the air date, through `NextEpisode`). Whenever the plugin cannot answer (no routes, no server key, TMDB down) they use Seerr's own text, as the app did without a key. A 503, a 404 with no JSON body, a 401 or a 403 puts the server's routes aside for five minutes (`tmdbAvailable()`), and a timeout does not. An English language asks Seerr in English and never the plugin. The old `tmdbApiKey` setting, its Integrations screen and the sync of it are gone, and a key an earlier build stored on the device is dropped at the first start.

Known limits, accepted: a plugin that hangs makes each Seerr title wait for the 8 second timeout once per title and holds a slot of the media server request queue for that long, the plugin's TMDB routes are not skipped when the Moonfin plugin setting is off (one 404 per five minutes), a title that loaded during the five minute window keeps Seerr's text until it is opened again, and a refusal (401, 403) from an expired token also puts the routes aside for five minutes.

### Talking to the plugin fork's chat

When the plugin fork's chat is open at the same time (`ListAgents` shows it as a peer session, named `implement-...`, and `SendMessage` reaches it; confirm by asking its working folder first), the two chats talk directly instead of through the user:

1. Short factual messages: status, a question, an answer, a path.
2. Never ask the other chat to do what needs the user's approval or what a session's own permissions would block. The user keeps the go for a plugin release (`-Publish`), for installing it on the server and restarting Jellyfin, and for any change to the route contract in the plugin's CLAUDE.md ("What the TV client expects").
3. Reports that are for the user go to the user. What the user must decide goes to the user, not to the other chat.
4. Reply with `SendMessage` to the `from` address of the message received. No polling and no "are you done?".
5. A plugin fact (a route shape, a version, a release state) is asked of the plugin chat; a client fact (what this app reads, a path here) is answered here.

The plugin chat works in `E:VSCode ProjectsMoonfin Plugin Forkimplement`. Never `git add -A` or commit in that folder from here: its working tree holds the other chat's unfinished work (that happened once and put its work in the wrong commit).

### 12. TMDB text through the plugin fork

- **Upstream:** the client has no TMDB key and reads Seerr's own text.
- **The fork keeps:** `services/tmdbProxy.js` and the callers listed in "The plugin fork, and the TMDB text": the words of a Seerr title and its seasons, and the online recommendations, come from the fork plugin's `Moonfin/Tmdb` routes, with Seerr's text as the fallback.
- **On a merge:** keep the proxy calls in `seerrTitle.js`, `seerrSeasons.js`, `homeRecommendations.js` and `useSeerrDetailsData.js` (the status poll asks Seerr alone, `statusOnly`), and never bring back a TMDB key or a direct call to api.themoviedb.org.
- **Files:** `services/tmdbProxy.js`, `utils/seerrTitle.js`, `utils/seerrSeasons.js`, `utils/tmdbText.js`, `services/homeRecommendations.js`, `views/Details/useSeerrDetailsData.js`.

### 13. The subtitle lift and the second subtitle track

- **Upstream:** `getSubtitleOverlayStyle(settings, shiftPercent)` moves the first subtitle up when a second SRT or WebVTT track is on screen (dual subtitles, 92978038), and draws both in `views/Player/SubtitleTextOverlay.js`.
- **The fork keeps:** its own lift, where the controls and the pause description push the subtitles up as a slide (`useSubtitleLift`, `subtitleBottomPercent`, `canvasLiftFor`, the PGS and ASS canvas), so the helper is `getSubtitleOverlayStyle(settings, lift, shiftPercent)` and `SubtitleTextOverlay` takes a `lift` prop and keeps the `data-subtitle-text` marks that `styles/perf-overrides.less` reads.
- **On a merge:** keep both arguments, and keep `lift={subtitleLift}` where the players draw `SubtitleTextOverlay`.
- **Files:** `utils/subtitleConstants.js`, `views/Player/SubtitleTextOverlay.js`, `TizenPlayer.js`, `WebOSPlayer.js`.

### 14. The Seerr trailer lookup, Discover sliders and the sign-in PIN

- **Upstream:** a trailer picker for titles with several trailers (`trailerChoices`), Seerr's custom Discover sliders as Home rows and on Discover (rebuilt Discover rows cut to 9 titles a page), and a server-backed sign-in PIN through the plugin (`useSignInPin`, `utils/signInPin.js`) that replaced the local PIN gate.
- **The fork keeps:** the lookup of the trailer Seerr knows for a library title that carries none (`lookedUpVideoId`, `hasLookedUpTrailer`) next to upstream's picker; its own Discover screen (entry 2) with the sliders added to its `rowConfigs` and every title of a slider page kept; and takes upstream's sign-in PIN whole.
- **On a merge:** keep the lookup in `useDetailsTrailer.js`, the `rowConfigs` use in `visibleRows` of `SeerrDiscover.js`, and upstream's PIN code as it comes.
- **Files:** `views/Details/useDetailsTrailer.js`, `views/SeerrDiscover/SeerrDiscover.js`, `App/App.js`.

## When the user says Moonbase (the plugin) updated

The fork works around things the Moonbase plugin (Moonfin-Client/Plugin) does not do yet. When the user says a new release is
out, check each item against the release notes and the plugin's code (GitHub, or ask for the plugin version), then remove
what the plugin now does. Say what was removed and what was kept. Each item is checked on its own:

1. **`language` on `/Moonfin/CustomRows/Items`** (plugin commit "Add Localization Support for Custom Home Rows (#320)", merged
   2026-10-14, after release 2.4.0, which the user had). Once a release carries it, the TMDB and custom list rows come back
   in the metadata language from the plugin. Then remove the client-side pass in `views/Browse/useExternalRows.js`
   (the `localizeSeerrCards` map before the rows are built) and `localizeSeerrCards` itself in
   `utils/localizeExternalItems.js` with its tests. Keep the `language` parameter the client sends
   (`services/externalRowsApi.js`, `utils/externalHomeRows.js`, which upstream sends itself now, see entry 5). Check on the TV first that a list row is in Romanian with the
   client pass off, since a copy the plugin cached in English can still come back.
2. **The seasonal row** (`/Moonfin/...` seasonal endpoint) had no language parameter even in the plugin's master. Keep
   `localizeExternalItems` for it until the plugin adds one.
3. **The TMDB text.** The fork's plugin (Licaa21/Plugin, see the section above) serves it, and the app has no key of its own. Upstream's Moonbase does not have those routes: if the user goes back to it, Seerr titles and episodes are in Seerr's own language and the online recommendations come from Seerr.
4. **README on `main`:** reword the "Rows in the metadata language" line to match what is left, and the line about the
   TMDB key if item 3 changed.

## Packages (.wgt)

- Only built in `daily/`, only the regular Tizen build. Never `--oblong` and never `--legacy`.
- Build with `bash fork-tools/build-daily-wgt.sh`. It names the file like the upstream package with `_Lica_Fork` added:
  `Moonfin_Tizen_Regular_v<version>_Lica_Fork.wgt`, for example `Moonfin_Tizen_Regular_v2.10.0_Lica_Fork.wgt`.
- They are ignored by git and never committed, and no other folder keeps any. One file, rebuilt over the old one. A
  throwaway test build gets a clearly different name and is deleted after.
- Each build is published as a GitHub release of its own by `fork-tools/publish-wgt.sh` (the build script runs it, and it can be run alone for a package already built). Releases are kept, a build never replaces another. They carry the fork's own version, starting at **1.0.0** (Lica's Fork 1.0.0 was the build of 2026-10-22). **The version is always written with three numbers** (1.0.0, 1.1.0, 1.1.1, never 1.0 or 1.1), in the tag, the title, the file name and the description: the tag is `fork-v<version>`, the title "Lica's Fork <version> (Moonfin <moonfin version>)", while the file name keeps `Lica_Fork` without the apostrophe, which shells and links do not like, the package file carries it too (`Moonfin_Tizen_Regular_v<moonfin version>_Lica_Fork_v<version>.wgt`, the one from the last build is removed locally), and the description says what was done since the last release, the fork's commits and upstream's apart, with the commit ids (commits whose message starts with "CLAUDE.md:" or "README:" are left out). The package itself still never goes in a branch. If `gh` is missing or signed out nothing is published and the file stays here (`gh` lives in `%LOCALAPPDATA%GitHubCLIin`, which the script adds to its path when a shell lacks it). The newest release is always at https://github.com/Licaa21/Smart-TV/releases/latest
- **The fork's version moves with the size of what was done since the last release, and Claude chooses the step when building and says which and why**, then runs the build with `BUMP=patch`, `BUMP=minor` or `BUMP=major` (the build script passes it on, and the publish script stops and asks for it when it is missing):
  - **patch** (1.0.0 to 1.0.1, then 1.0.2, 1.0.3...): one modification, or bug fixes.
  - **minor** (1.0.1 to 1.1.0, then 1.2.0, 1.3.0...): medium sized modifications, and the patch number starts over.
  - **major** (1.3.0 to 2.0.0, then 3.0.0...): a whole batch of about 10 to 20 modifications, and the other numbers start over.
  A merge from upstream that brings a lot counts by what it brings. `FORK_VERSION=<x.y.z>` sets the version outright when it has to be corrected.
- The build runs the lint and a CSS check against the old TV browsers (chrome >= 38), so `gap`, `grid-gap` and similar
  fail it. Use flex with margins.

## Tools

- `fork-tools/update-daily.sh`: the merge into `daily` (see "How changes flow").
- `fork-tools/build-daily-wgt.sh`: builds the package (see "Packages").
- `fork-tools/publish-wgt.sh`: publishes the built package as a release of its own (see "Packages"). `--version` only prints the version the next release will have, which the build stamps into the app (see entry 9).
- `fork-tools/link-modules.ps1`: links a folder's `node_modules` to the ones in `main/`.
- `fork-tools/check-romanian.js`: the Romanian check (see "Strings and languages").
- `scripts/gen-accent-rules.js`: regenerates `packages/app/src/theme/accentRules.generated.js` from the stylesheets. Run
  it after changing any `.module.less` and after every merge.
- `fork-tools/browser-mock.js`: fakes the Jellyfin server (a library of 100 movies) and Seerr, for looking at screens in a
  browser.

### Looking at screens in a browser

1. From `packages/app`: `REACT_APP_PLATFORM=tizen npx enact serve --port 8123` (the repository script is
   `npm run dev:tizen`). It takes a minute to compile.
2. In the Playwright tool, run `fork-tools/browser-mock.js` (it signs in a fake user). The first run shows a setup
   wizard: click "Skip setup".
3. Keys: arrows move, Enter selects, Escape is Back. The browser is a modern Chrome, so older-set behaviour (such as
   rows starting short on a Medium performance tier) needs the `performanceMode` setting set to `mid` in
   `localStorage` key `moonfin_settings`.
4. Stop the server when done.

For the user's own server and Seerr instead of the fake one, see "Testing against the real server" below.

### Testing against the real server

- **Claude is authorised to launch the test browser (Playwright, see "Looking at screens in a browser") against the user's own Jellyfin server and Seerr**, signed in as the test user **Claude** by default (a normal user that cannot delete or download and sees every library) or as the administrator **Lica** for what only an administrator sees (both logins are in `local/test-server.md`), whenever that tests a change better than the fake server does (a real library, real posters, a real genre or studio, real Seerr titles, the Moonfin plugin's rows). Say in the report that the real server was used, and use the fake server (`fork-tools/browser-mock.js`) when it is enough.
- **The login is never written in this file or in anything tracked.** This file is committed and the fork is public, so the address, the user and the password live only in `local/test-server.md` (ignored by git in every folder), and are read from there when needed. They never go in a commit, a branch, a pull request, a diagnostic report, a log or a screenshot that is kept outside `local/`.
- **Two logins, both in that file.** Claude, a normal user, is the one for testing in general. Lica, the administrator, is only for testing what an administrator alone sees or can do in the app (admin only screens and settings, the server messages, the Moonfin plugin's admin parts), and for work on the test user itself. Whichever is used, the test is read only, since it is a real library: with Lica, take extra care, as an administrator can also delete, so nothing is deleted, edited or configured, and a setting is only read, never changed, unless the user asks for that change.
- Seerr: Claude is imported in Seerr with no permissions (it can browse and cannot request), and the plugin's Seerr session for it is made by posting its Jellyfin login to `/Moonfin/Seerr/Login`, as the app's own Seerr sign in does.
- To sign the browser in, run `node fork-tools/make-real-session.js` (or `... Lica` for the administrator) and then run the file it writes, `.playwright-mcp/real-session.js` (git ignores that folder, and the session is in the file), with the Playwright tool, the way `browser-mock.js` is run. The tool's code cannot read files, which is why the script exists. The browser's own setting "Always sign in" must stay off, or the app shows its picker and asks for the password. Stop the dev server and close the browser when done.

## Where things are in the code

- Accent colors, the skip prompt editor and the Seerr/Home row work are fork-only, in `implement`.
- Shared filter popup: `packages/app/src/components/FilterPopup`.
- Long audio and subtitle lists (chips, search, pinned actions, the Channel keys): `packages/app/src/components/TrackFilterBar` and `utils/trackFilter.js`, used by `views/Player/PlayerControls.js` and `views/Details/DetailTrackModals.js`.
- Home: `packages/app/src/views/Browse/Browse.js`. Seerr screen: `packages/app/src/views/SeerrDiscover/`.
- Screens without a library of their own (a genre or studio opened from Home, the Genres screen with no library chosen, and the Seerr browse screen) are laid out by the movies library, or the shows one for series only: `utils/styleLibrary.js`, `hooks/useStyleLibraries.js`, `useStorage` keys `library_*_<library id>`. The Library screen takes its cards, grid, letters, sort and group from it and writes changes back to it (`followsLibrary` in `views/Library/Library.js`); the Seerr browse screen is built in the Library's own frame (its page, header in the chosen style, focused title block, grid, status line and Home button, with the navbar hidden as on the Library), with cards that carry the year and the rating. Its search asks Seerr for a genre or a plain Movies / TV Shows browse (`filterSearchResults`, a hundred titles, kept to the screen's type and genre), since a title can stand thousands of places down a genre's popularity, and narrows the loaded titles for a studio, network or keyword, which Seerr cannot search inside. Titles are merged by type and id (`mergeTitles`), and each load of the list is a run of its own, so two loads can no longer add the same pages (the screen drew every title two or three times). Letters are left out, since the list is in Seerr's own order. The card a title was opened from, with the sort and filters, is kept for the one return from its details page only (`takeBrowseState` and `forgetReturnPoint` in `seerrBrowseState.js`); every other visit starts on the first title with the default sort and no filters. Back on a scrolled grid returns it to the first title before it leaves, as in the library (`useQuickReturnGrid`), and a visit puts focus on the first card by index, since the list would otherwise restore the index the last browse was left at.
- Filters on those screens are only the ones that fit a list that is not a library: the Library in genre or studio mode offers Sort By, Favorites, Played Status and My Rating (no Features, Quality or Source, and none of the server-wide lists, since `getQueryFilters` cannot be scoped to a genre or studio); the Seerr browse screen has no Movies / TV Shows switch and no genre list on a genre screen; `GenreBrowse` has no Movies / TV Shows filter. The Seerr option lists are read as arrays only.
- Player controls are the light ones on every performance level (the ring and tooltip drawn in a layer of their own, no fade on a focus move, the clock redrawn once a second while the controls are up, Left and Right straight to the neighbour button): `utils/playerClock.js`, `TizenPlayer.module.less`, `WebOSPlayer.module.less`, `PlayerControls.js`. Ultra felt them lag where Medium did not. The skip, Next Up and Still Watching boxes still lose their blur only from Medium down.
- Channel Up and Down switch between a screen's header and its cards, as in the subtitle menu (`hooks/useHeaderGridKeys.js`): the Library in every style, the Seerr browse screen, Favorites and Genres. The Seerr browse header has Search (narrows the loaded titles by name, `filterTitlesByName`), Sort, Filters and Display in all three styles, and Display writes to the library's own card settings.
- **The fork's defaults** are held by the Moonbase plugin fork, not by the app. The app's built-in defaults (`context/defaultSettings.js`, `utils/homeLayout.js`) are Moonfin's own again, so a viewer's TV with no server profile behaves as upstream does. Every setting that is not tied to the device is in `SYNCABLE_KEYS` (`context/SettingsContext.js`), so the plugin can hold a default for it: the user's choices (the glass theme, white accents, Romanian, the left sidebar, the Modern library style, the Home rows and their order, the audio codec order, the button lists and about 70 more) are filled in the plugin's User defaults (139 values on 2026-10-25) (Jellyfin dashboard, Moonbase, User defaults, tab "All TV app settings"), and a signed in account takes them wherever its own profile says nothing (profile, then global, then the plugin's defaults, then the built-in). `maxBitrate` and `screensaverTimeout` travel as the other clients write them, Mbps text ('120', 'auto' for Auto) and a unit with a count ('m5'), through `VALUE_CONVERSIONS`. Kept in the app only, since the plugin cannot give them or they belong to the device: the PIN and kids mode state, auto login and always authenticate, insecure certificates, the performance level, the passthrough and Xbox keys, the time offset, the server sort, custom home rows, subtitle download languages, and anything that acts before sign in (the sign in screen's language). The list of the plugin's fields is in the plugin fork's `local/client-settings.json` and `plugin-added-keys.json`. On 2026-10-25 the defaults were applied to Lica only: the plugin's `PushDefaults` (overwrite false) wrote them into her global profile, and her tv profile was rebuilt without the keys a default now holds, since the tv profile beats the global one. Her profile before is `local/lica-profile-before-defaults.json`, after is `lica-profile-after-defaults.json`, and the plugin configuration before and after the 2.4.0.2 install and the fill are the `moonbase-config-*.json` files there (they hold the Firebase push credential, so they stay in `local/`). To change a default, change it in the plugin's User defaults, and ask first. Before the plugin held them (until 2026-10-25) the same values were built into the app, in the commit db19accc, which was reverted.
- The Settings switch on a focused row is inked against the row's fill, not the page's ink, so it shows on Glass's white rows and under a white accent (`themeOverrides.js`, the rules after `.toggleOn`).

## The user's TV

Samsung QE65Q67AAUXXH (2021 Q67A, 65 inch, 1920x1080 UI). The diagnostic report calls it `QAQ6D` with TV Version 8.0, and
the user agent says Tizen 6.0 with Chromium 76. When something remuxes or fails to play, the first place to look is the
log: the report prints the build commit, and the start decision, the opened media and the failed loads log the server's
`transcodeReasons`.

### Lag on Home

Home lags more than the Seerr screen on this TV because it draws more. Read from the code, not measured: rows start at 12
cards and grow by 10 (`utils/rowCap.js`, from the Medium performance level down), only the focused card has a layer
(`ModernMediaCard.module.less`), and Home pins a row with two animation-frame passes per focus. Not done, since they would be
seen: the row scrolling sideways on every press (upstream 9e3c974b), drawing only the rows near focus, removing text
shadows (`perf-lean` does it at the Low level), and a lower backdrop blur (the setting itself does it). To test on the TV
without code: set the background blur to 0, and the Performance level to Low. `memo(Browse)`, an idle fill after Back, a
stored cache that is not written when dynamic rows are on, and a memoized Seerr context value are in.

### Audio

- AVPlay does not list TrueHD, so a file whose first track is TrueHD opens on the first track the set decodes. The app's
  own playability check calls TrueHD playable, so TrueHD is never counted as a track a file opens on.
- AVPlay refuses `setSelectTrack` while READY (`PLAYER_ERROR_INVALID_STATE`), so a pick can only be switched once playing.
- A switch inside one codec took (AC3 5.1 to AC3 2.0). A switch across codecs (FLAC to AC3) failed with
  `PLAYER_ERROR_NOT_SUPPORTED_FORMAT` about 200 ms later or was never applied, so such a pick is built on the server.
- FLAC inside a video file is left out of the device profile on purpose (audio delay), so it is always remuxed.
- Max Audio Channels at 2 sends every 5.1 track through the server (`AudioChannelsNotSupported`). Leave it on Auto and let
  the TV mix down, and use `Prefer Stereo Tracks` to rank 2.0 tracks first.

### Direct play and bitrate

- The Tizen profile limits older sets to 32 streams in a file (`StreamCountExceedsLimit`). The Godfather remux has 42, so
  the `Allow Files With Many Streams` toggle lifts it. It direct played with that and
  `Play Dolby Vision Profile 7 as HDR10` on.
- The Max Streaming Bitrate Auto is 60 Mbps on a 4K set, which a 64 Mbps remux exceeds and gets re-encoded at. Set it
  higher.

### AV1

AV1 inside an HLS stream is refused by AVPlay (`PLAYER_ERROR_CONNECTION_FAILED` then `NOT_SUPPORTED_FILE` within a second,
master or media playlist alike), and a server remux of AV1 can only be fMP4 HLS. So an AV1 file whose audio the set cannot
decode (DTS) only plays through `Force Compatible AV1 Transcode`, which re-encodes the video. Leave it on. An AV1 file with
AC3 audio is the one that should direct play from MKV.
