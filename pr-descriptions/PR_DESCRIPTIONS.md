# PR descriptions for Moonfin-Client/Smart-TV

Open each one as **head `Licaa21:<branch>` → base `main`**. Every body follows the repo's
`.github/pull_request_template.md`. Tick the "Tested on physical device" boxes yourself where you did.

`CLAUDE.md` says to keep PRs narrow, and each branch below is based directly on `upstream/main` (`b67705e7`),
so the diffs are only their own changes.

---

## 1. `fix/details-track-buttons-start-track`
**Title:** Show the track playback will start on in the details Audio and Subtitle buttons

```
# Pull Request

## Summary
The details screen named the server's default Audio and Subtitle track, so an episode nobody had
played yet showed "Subtitle: Off" while playing it started on the preferred language. The buttons
now ask the same questions the player does, and stay blank until those picks are in rather than
flashing the unset defaults first.

## Related Issues
- Related to #

## Type of Change
- [x] Bug fix

## Changes Made
- The details Audio button uses the player's audio selection (series memory, then audio language
  from Settings, then the server default).
- The details Subtitle button uses the player's initial subtitle resolution (remembered pick for the
  episode or series, then subtitle mode and languages from Settings).
- The caption under both buttons is hidden while the item is still a seed, so it doesn't flash the
  unset defaults.
- The player's text-subtitle fetch log line now includes how long the fetch took (`fetchMs`).

## Platform
- [x] Both / Shared code

## Testing
- [x] Manual testing completed
- [ ] Tested on physical device

Unit tests (`initialSubtitle.test.js` extended), lint and the full suite pass.

### Test Steps
1. Set a subtitle language in Settings and open an episode you have never played.
2. The Subtitle button names that language once loaded (it doesn't show Off first).
3. Play it and confirm it starts on the same track.

## Checklist
- [x] Code builds successfully
- [x] Code follows project style and conventions
- [x] No unnecessary commented-out code
- [x] No new warnings introduced
```

---

## 2. `feature/audio-codec-priority`
**Title:** Add an Audio Codec Priority setting and scroll Settings pages back to the top

```
# Pull Request

## Summary
Adds an Audio Codec Priority page under Settings → Playback → Audio Preferences where the codecs (TrueHD, DTS-HD, DTS,
Dolby Digital Plus, Dolby Digital, FLAC, PCM, Opus, AAC, Vorbis, MP3) are ranked best first. The
ranking only settles ties between tracks in the preferred language, ahead of channel count. Also
brings a Settings page back to its top when focus reaches the first row.

## Related Issues
- Related to #

## Type of Change
- [x] New feature
- [x] UI/UX update

## Changes Made
- New `audioCodecs.js` (codec list, spelling normalisation such as `ac-3` / `dca`, DTS-HD told apart
  from the DTS core by its profile).
- `selectPreferredAudioStream` ranks tied tracks by the viewer's codec order before channel count.
  Without an order it behaves exactly as before.
- Settings → Playback → Audio Preferences → "Audio Codec Priority" reuses the button layout editor as an order with nothing
  to switch off; rows show their place in the ranking.
- Settings pages scroll back to the top when focus reaches the first row, so the heading above it is
  not stranded past the edge.
- The setting stays on the device (Moonfin Core has no such setting, so it is not synced).
- Three new strings, added to `resources/strings.json` in alphabetical order.

## Platform
- [x] Both / Shared code

## Testing
- [x] Manual testing completed
- [ ] Tested on physical device

Unit tests added for codec ranking and for the Settings scroll; lint and the full suite pass.

### Test Steps
1. Settings → Playback → Audio Preferences → Audio Codec Priority.
2. Move a codec up or down and save.
3. Play a file with several tracks in your audio language and confirm the highest-ranked codec is chosen.

## Screenshots (if applicable)
![Audio Codec Priority](https://raw.githubusercontent.com/Licaa21/Smart-TV/assets/pr-screenshots/pr-screenshots/audio-codec-priority.jpg)

## Checklist
- [x] Code builds successfully
- [x] Code follows project style and conventions
- [x] No unnecessary commented-out code
- [x] No new warnings introduced
```

---

## 3. `feature/seekbar-focus-halo`
**Title:** Make the focused seek bar thumb easier to see on Tizen

```
# Pull Request

## Summary
The only focus cue on the seek bar was the thumb turning white, which is easy to miss from across the
room. It now also scales up and gets an accent halo, matching the other focused rows in the player.

## Type of Change
- [x] UI/UX update

## Changes Made
- `.progressBar:focus .seekIndicator` scales the thumb to 1.4x and adds an accent halo
  (`--theme-accent-rgb`) and a soft shadow, with a short transition.

## Platform
- [x] Tizen (Samsung)

## Testing
- [x] Manual testing completed
- [ ] Tested on physical device

### Test Steps
1. Play any video and open the controls.
2. Move focus onto the seek bar.
3. The thumb is clearly larger with a halo.

## Checklist
- [x] Code builds successfully
- [x] Code follows project style and conventions
- [x] No unnecessary commented-out code
- [x] No new warnings introduced
```

(The same selector exists in `WebOSPlayer.module.less`; this PR leaves webOS alone.)

---

## 4. `feature/anime-markers-all-details`
**Title:** Show the anime marker pills on every details layout

```
# Pull Request

## Summary
The anime marker pills (Anime, OVA and so on) only appeared on some screens. They now show on every
details layout and on the episode cards that have room for them.

## Type of Change
- [x] UI/UX update

## Changes Made
- Pills under the title on Classic, Minimalist, Nouveau and Spotlight.
- Pills on the Minimalist and Nouveau episode cards; the marker takes the top corner because the
  episode number holds the bottom one.
- Spacing so the pills sit midway between the metadata line and the ratings, and take no room when a
  title has no markers.

## Platform
- [x] Both / Shared code

## Testing
- [x] Manual testing completed
- [ ] Tested on physical device

## Checklist
- [x] Code builds successfully
- [x] Code follows project style and conventions
- [x] No unnecessary commented-out code
- [x] No new warnings introduced
```

---

## 5. `feature/search-home-cards`
**Title:** Draw search results with the Home cards and rows, and rank the best matches first

```
# Pull Request

## Summary
Search drew its own cards. Results now use the rows and cards Home uses, so they follow the Home
settings for style and artwork. A Seerr search opens on a "Most relevant" row.

## Type of Change
- [x] UI/UX update
- [x] Refactor

## Changes Made
- Search results are drawn with Home's rows and cards, in the shape that fits each kind of result
  (stills for video, squares for music and playlists, a circle for people, posters otherwise).
- A Seerr search opens on a "Most relevant" row (exact title, then starts with, then contains), then
  the rest sorted by type.
- Focus moves predictably between the search field, the tabs and the first card, and the page scrolls
  back to its top when focus returns up to them.
- `MediaRow` accepts a `spotlightId`; `SpottableInput` accepts an `onExitBottom` hook.
- New string "Most relevant".
- Tests: `searchGroups.test.js`, extended `Search.remote.test.js`.

## Platform
- [x] Both / Shared code

## Testing
- [x] Manual testing completed
- [ ] Tested on physical device

## Checklist
- [x] Code builds successfully
- [x] Code follows project style and conventions
- [x] No unnecessary commented-out code
- [x] No new warnings introduced
```

---

## 6. `fix/read-more-only-when-truncated`
**Title:** Show "Read more" on the details overview only when the text is cut off

```
# Pull Request

## Summary
The Read more toggle showed whenever the overview box was a pixel shorter than its content, and
could be missing or show for a single line when the column was short of room.

## Type of Change
- [x] Bug fix

## Changes Made
- Truncation is judged against the lines the clamp allows (half a line is the dividing mark), not
  against the box height, which browsers round separately from the text.
- Measured again when fonts finish loading and when the box or window resizes.
- Tests: `ExpandableOverview.test.js`.

## Platform
- [x] Both / Shared code

## Testing
- [x] Manual testing completed
- [ ] Tested on physical device

### Test Steps
1. Open a title with a short overview: no Read more button.
2. Open a title with a long overview: Read more appears and expands it.

## Checklist
- [x] Code builds successfully
- [x] Code follows project style and conventions
- [x] No unnecessary commented-out code
- [x] No new warnings introduced
```

---

## Already-open PR #494 got two more commits
Add this to the description of
`feature/episodeselector-skipperlayout-accentcolors` (#494). The branch is already pushed.

- **Next Up overlay ink:** button text and ring now follow the theme's on-accent ink, so a bright
  accent (8-bit Hero) stays readable.
- **Season jump:** in the episode browser, channel up/down steps to the next/previous season from
  anywhere in the panel, with a footer hint (one new string: "Press CH +/- to change season").
