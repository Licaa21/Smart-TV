# Moonfin Smart TV fork — working notes

This is a personal fork of [Moonfin-Client/Smart-TV](https://github.com/Moonfin-Client/Smart-TV),
set up with an `upstream` remote pointing at the original repo and `origin` at this fork
(`Licaa21/Smart-TV`). Before starting new work, sync `main`: `git fetch upstream && git checkout main
&& git merge --ff-only upstream/main && git push origin main`. **`main` is kept as an exact
upstream mirror — never commit to it directly.** Every other branch below is based on it.

## Prior session history

`.remember/now.md` (and the dated files next to it) holds a running log of what happened in past
sessions on this repo — check it before assuming something is new. It's gitignored (local-only,
not project content).

## Branches with an open upstream PR

| Branch | PR | Purpose |
|---|---|---|
| `fix/av1-fmp4-fallback` | [#484](https://github.com/Moonfin-Client/Smart-TV/pull/484) | Opt-in setting to transcode AV1 sources to HEVC instead of copying into fMP4 HLS (some Tizen firmware can't play that). |
| `fix/tizen-avplay-restore-black-screen` | [#486](https://github.com/Moonfin-Client/Smart-TV/pull/486) | Player doesn't recover from standby/backgrounding — black screen, no audio, stuck error screens, etc. 10 separate root causes found and fixed one at a time via on-device diagnostic testing. Includes permanent `Standby diag:` logging gated behind the existing Diagnostics setting. The reload-failed error now shows a default-focused Retry button instead of defaulting focus to Go Back — Go Back being focused meant the natural OK-press response exited playback instead of retrying. |
| `feature/episodeselector-skipperlayout-accentcolors` | [#494](https://github.com/Moonfin-Client/Smart-TV/pull/494) | Per-surface accent colors, Skip Intro/Recap/Credits + Next Episode prompt appearance editor, in-player episode browser. |
| `feature/details-rows-catalogue-ranking` | [#495](https://github.com/Moonfin-Client/Smart-TV/pull/495) | Details screen action button rows rank against the whole catalogue, like Settings does. |
| `feature/trailer-back-to-close` | [#496](https://github.com/Moonfin-Client/Smart-TV/pull/496) | Back closes a playing trailer and stays on the title, instead of leaving Details. |
| `feature/person-screen-redesign` | [#497](https://github.com/Moonfin-Client/Smart-TV/pull/497) (draft) | Person screen redesign — portrait, backdrop, dedup. **Stacked on #494** — built on top of the accent-colors branch since the portrait's focus glow reads the generated accent rules. Diff won't narrow to just this PR's own changes until #494 merges and this branch is rebased on top of it. |

## Other branches

| Branch | Purpose | Status |
|---|---|---|
| `main` | Exact upstream mirror. Never commit here. | — |
| `debug/standby-diagnostics` | Historical — was the diagnostic-logging fork of `fix/tizen-avplay-restore-black-screen` before that logging got merged into the PR itself. Functionally identical to #486 now; no unique content left on it. | No PR, pushed for visibility |
| `local/combined-daily-driver` | Synced `main` + every fix/feature branch above, for actual daily use on a real TV. **Never open a PR from this.** Rebuild by re-merging any branch above after it changes. | Local-only, pushed for visibility, not for PR |
| `builds/daily-driver` | Holds only the latest built `.wgt` from `local/combined-daily-driver`. Each new build replaces the old file. | Local-only, pushed for visibility, not for PR |
| `assets/pr-screenshots` | Orphan branch hosting on-device screenshots referenced from PR descriptions via `raw.githubusercontent.com` links. Not meant to be merged anywhere. | Local-only, pushed for hosting only |
| `webos-fix`, `slowplayer` | **Not ours** — these exist on `upstream` too, shared with the Moonfin-Client project. Never delete or rewrite these. | Upstream-shared |

To build: `npm run build:tizen` from the repo root (produces `Moonfin_Tizen_Regular_2.9.0.wgt`).
To install to a connected TV: `npm run install-tv` (needs `sdb connect <TV_IP>` first, TV in
Developer Mode). Lint a file with `cd packages/app && npx enact lint <path>`.

## Testing standby/resume fixes

Diagnostic reports come back from the TV as a `logs.md` paste (gitignored, gets overwritten each
test — don't assume it's the same file twice, check the `Generated:` timestamp at the top). Any
build from `fix/tizen-avplay-restore-black-screen` onward has `Standby diag:` logging built in, but
it only records anything if the person testing has Settings → Diagnostics → diagnostic logging
turned on first — confirm that before treating a log with no `Standby diag:` lines as meaningful;
it may just mean the setting was off, not that nothing happened.

The standby bug has turned out to be several independent root causes, not one — each fix in PR #486
was found and confirmed from a real reproduced log before being written, not guessed. If a new
report of "it still doesn't work" comes in (e.g. from a different Tizen version), don't assume it's
one of the 10 already-fixed causes; get a fresh log with diagnostic logging enabled first.

## PR hygiene

Each PR above should stay scoped to just what its table row describes — don't bundle unrelated
fixes into an existing PR branch. `local/combined-daily-driver` is where everything actually lives
together; PR branches stay narrow on purpose so upstream can review and merge them independently.
When a PR branch changes, re-merge it into `local/combined-daily-driver` and rebuild.
