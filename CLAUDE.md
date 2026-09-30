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

## Branches

| Branch | Purpose | Status |
|---|---|---|
| `main` | Exact upstream mirror. Never commit here. | — |
| `fix/av1-fmp4-fallback` | AV1 sources get an opt-in setting to transcode to HEVC instead of copying into fMP4 HLS (which some Tizen firmware can't play). | PR [#484](https://github.com/Moonfin-Client/Smart-TV/pull/484), open |
| `fix/tizen-avplay-restore-black-screen` | Player doesn't recover from standby/backgrounding — black screen, no audio, stuck error screens, etc. 10 separate root causes found and fixed one at a time via on-device diagnostic testing (see PR body for the full list). Includes permanent `serverLogger.playback('Standby diag: ...')` logging at every decision point in the resume/background flow — gated behind the existing Diagnostics setting, so it ships to everyone but only records for users who've turned diagnostic logging on. Kept it in the PR deliberately: every fix here was only confirmable because of this logging, and the next report from an unseen Tizen/firmware combination needs the same data without a special debug build. | PR [#486](https://github.com/Moonfin-Client/Smart-TV/pull/486), open |
| `debug/standby-diagnostics` | Historical — was the diagnostic-logging fork of `fix/tizen-avplay-restore-black-screen` before that logging got merged into the PR itself. The two are now functionally identical (module `RESTORE_TIMEOUT_MS` etc. aside from ordering); keep using this branch name out of habit if it's easier, but there's no unique content left on it worth diffing for. | Local testing branch, pushed for visibility |
| `local/combined-daily-driver` | Synced `main` + the AV1 fix + all standby fixes, for actual daily use on a real TV. **Never open a PR from this** — the user explicitly wants the AV1 fix kept out of PR #486. Rebuild by re-merging both fix branches after any of them change. | Local-only, pushed for visibility, not for PR |

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
