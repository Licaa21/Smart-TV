<h1 align="center">Moonfin for Smart-TVs</h1>
<h3 align="center">Premium Jellyfin and Emby client for webOS and Tizen TVs</h3>

---

<p align="center">
   <img width="1920" height="1080" alt="splash-background" src="https://github.com/Moonfin-Client/.github/blob/main/logo.png" />
</p>

[![License](https://img.shields.io/github/license/Moonfin-Client/Smart-TV.svg)](https://github.com/Moonfin-Client/Smart-TV)
[![Release](https://img.shields.io/github/release/Moonfin-Client/Smart-TV.svg)](https://github.com/Moonfin-Client/Smart-TV/releases)
[![github](https://img.shields.io/github/downloads/Moonfin-Client/Smart-TV/total?logo=github&label=Downloads)](https://github.com/Moonfin-Client/Smart-TV/releases)
[![BuyMeACoffee](https://raw.githubusercontent.com/pachadotdev/buymeacoffee-badges/main/bmc-yellow.svg)](https://www.buymeacoffee.com/moonfin) 
[![Discord](https://img.shields.io/badge/Discord-Join%20Us-5865F2?logo=discord&logoColor=white)](https://discord.gg/moonfin)

> **[Back to main Moonfin project](https://github.com/Moonfin-Client)**

## What is Moonfin for Smart TVs?

Moonfin is a Jellyfin and Emby client for Samsung Smart TVs (Tizen), LG Smart TVs (webOS) and Fire TV sticks running Vega OS. One shared codebase powers every platform, with a video pipeline tuned for each, so you get hardware-accelerated playback, a UI designed around a remote instead of a mouse, and features that most TV clients leave out.

## Features

- **Hardware-accelerated playback** through Samsung AVPlay, webOS Starfish and the Fire TV WebView, with direct play first and a transcode fallback only when needed.
- **Lossless audio passthrough** for DTS, DTS-HD, and Dolby TrueHD to a capable receiver.
- **Multi-server and Emby support**, including Emby Connect, Quick Connect, and a unified library view across all your Jellyfin servers.
- **A setup wizard on first run** that walks you through the look of the app with live previews built from your own artwork, including five detail screen styles: Classic, Modern, Spotlight, Nouveau, and Minimalist.
- **Kids Mode and Blocked Ratings.** Kids Mode strips the app back for a child and locks the way out with a PIN, and blocked ratings apply everywhere, from home rows and search to detail screens and playback.
- **A proper on-screen keyboard** with layouts that follow your language, plus sign-in that finds servers on your network by itself.
- **Native Seerr integration** for browsing, discovering, and requesting content in HD or 4K from your TV, with requests, issue reporting, and a watchlist button built into the detail screen.
- **Retro games** played right on the TV from a server game library, with save states synced through the server. Needs webOS 5 or Tizen 5 and newer. See [Retro Games](https://github.com/Moonfin-Client/Plugin/wiki/Retro-Games).
- **Live TV and DVR** with a program guide that opens on your last channel, a quick channel changer during live playback, and recording management.
- **Advanced subtitles**, including PGS image subtitles and styled ASS/SSA through libass, plus in-app subtitle downloads.
- **SyncPlay and remote control**, for watching together in sync with others and for driving the TV from other Jellyfin apps, including typing a search from your phone.
- **Themes** with four built-in looks including Glass and 8-bit Hero, a Theme Store for community themes, custom themes, and accent color customization. Loading animations and the screensaver's backdrop, clock or logo are yours to customize with a live preview, and screens show skeleton placeholders while they load.
- **A featured media bar** with six layouts, including the rounded Aya hero.
- **Personal ratings** as a like, stars, or a score out of ten, usable as a library filter.
- **Achievement Badges** on Jellyfin servers that run the Achievement Badges plugin, and **anime markers** like Filler, Manga Canon, and Subbed/Dubbed on cards and detail screens from the Moonbase plugin.
- **Automatic performance tuning** that matches visual effects to how capable your TV is, with a manual override.
- **Wide device support**, from Samsung 2016 sets (Tizen 2.4) and LG webOS 3.0 through the latest models, including Let's Encrypt support on older webOS models whose built-in certificate stores are out of date.

The full list is on the [Features](https://github.com/Moonfin-Client/Smart-TV/wiki/Features) wiki page.

## Screenshots

<img width="1950" height="1060" alt="Home screen" src="https://github.com/user-attachments/assets/660712d2-1893-4c71-afff-5ddc9aa674e0" />
<img width="1950" height="1060" alt="Details screen" src="https://github.com/user-attachments/assets/11f74fad-fd72-43c4-9c6d-7f23c9672751" />
<img width="1950" height="1060" alt="Seerr discovery" src="https://github.com/user-attachments/assets/27eef61b-3295-4949-a34f-58b6166e6e94" />

More in the [Screenshots](https://github.com/Moonfin-Client/Smart-TV/wiki/Screenshots) gallery.

**Disclaimer:** Screenshots shown in this documentation feature media content, artwork, and actor likenesses for demonstration purposes only. None of the media, studios, actors, or other content depicted are affiliated with, sponsored by, or endorsing the Moonfin client or the Jellyfin project. All rights to the portrayed content belong to their respective copyright holders. These screenshots are used solely to demonstrate the functionality and interface of the application.

## Installation

Samsung and LG don't carry Moonfin in their TV app stores, so it's installed by sideloading. On LG the closest thing to a store is the **Homebrew Channel**, which lists Moonfin and updates it like any other app, no root needed. Everyone else downloads a package from the [Releases page](https://github.com/Moonfin-Client/Smart-TV/releases) and picks the file that matches the TV:

| Platform | File | Supported Devices |
|---|---|---|
| **Tizen Regular** | `Moonfin_Tizen_Regular_*.wgt` | Samsung Smart TVs (2017+, square icon) |
| **Tizen Oblong** | `Moonfin_Tizen_Oblong_*.wgt` | Samsung Smart TVs (2017+, oblong icon) |
| **Tizen Legacy** | `Moonfin_Tizen_Legacy_*.wgt` | Samsung Smart TVs (2016, Tizen 2.4) |
| **webOS** | `Moonfin_webOS_*.ipk` | LG Smart TVs (2016+, webOS 3.0+) |
| **Vega** | `Moonfin_Vega_*.vpkg` | Fire TV sticks on Vega OS (Fire TV Stick 4K Select and newer) |

The easiest route on each brand:

- **LG:** the Homebrew Channel if your TV has it. Otherwise LG's Developer Mode app plus [Dev Manager Desktop](https://github.com/webosbrew/dev-manager-desktop), a free desktop program that installs the `.ipk` in a few clicks. The webOS CLI (`ares-install`) works too.
- **Samsung:** the [Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung) tool, which signs and installs the `.wgt` for you.
- **Fire TV (Vega OS):** Developer Mode on the stick and the Vega SDK's `vega device install-app` on a computer, until the app is in the Amazon Appstore.

Step-by-step instructions for all of them, including turning on Developer Mode, are on the [Installation and Sideloading](https://github.com/Moonfin-Client/Smart-TV/wiki/Installation-and-Sideloading) page. Once installed, [Getting Started](https://github.com/Moonfin-Client/Smart-TV/wiki/Getting-Started) walks through connecting to your server.

Seerr is optional and connects through the [Moonfin server plugin](https://github.com/Moonfin-Client/Plugin) rather than directly, so nothing needs to be entered on the TV. See [Seerr Setup](https://github.com/Moonfin-Client/Smart-TV/wiki/Seerr-Setup).

## Documentation

The deeper reference material lives in the [Wiki](https://github.com/Moonfin-Client/Smart-TV/wiki):

| Page | What it covers |
|------|----------------|
| [Features](https://github.com/Moonfin-Client/Smart-TV/wiki/Features) | The full feature list, section by section |
| [Playback and Codecs](https://github.com/Moonfin-Client/Smart-TV/wiki/Playback-and-Codecs) | Video pipelines, direct play and fallback, audio passthrough, and subtitles |
| [Installation and Sideloading](https://github.com/Moonfin-Client/Smart-TV/wiki/Installation-and-Sideloading) | Which release file to pick, and how to sideload on Samsung and LG |
| [Getting Started](https://github.com/Moonfin-Client/Smart-TV/wiki/Getting-Started) | Connecting to your server, Quick Connect, the setup wizard, and the settings worth a look on day one |
| [User Guide](https://github.com/Moonfin-Client/Smart-TV/wiki/User-Guide) | The remote inside the player, typing on a TV, themes, home rows, and parental controls |
| [Common Problems](https://github.com/Moonfin-Client/Smart-TV/wiki/Common-Problems) | Plain fixes for connection, login, install, playback, sound and subtitle trouble |
| [Seerr Setup](https://github.com/Moonfin-Client/Smart-TV/wiki/Seerr-Setup) | Connecting Seerr through the Moonfin server plugin |
| [Building from Source](https://github.com/Moonfin-Client/Smart-TV/wiki/Building-from-Source) | Build scripts, the three Tizen variants, and dev servers |
| [Development](https://github.com/Moonfin-Client/Smart-TV/wiki/Development) | Project structure, platform abstraction, and developer notes |
| [Collecting Logs](https://github.com/Moonfin-Client/Smart-TV/wiki/Collecting-Logs) | Diagnostic logging and what to attach to an issue |

## Building

```bash
npm install
npm run build:tizen:all   # Samsung: Regular, Oblong, and Legacy
npm run build:webos       # LG
```

A current Node.js LTS release (20 or newer) with npm is the only prerequisite.

<details>
<summary><b>Advanced:</b> where the build CLIs live</summary>

`npm install` also sets up the build CLIs in the git-ignored `tools/` directory, which keeps them out of the lockfile on purpose. See `tools/package.json` for the reasoning. Full details, including the individual variant builds and the dev servers, are on [Building from Source](https://github.com/Moonfin-Client/Smart-TV/wiki/Building-from-Source).

</details>

## Contributing

Contributions are welcome. Check the existing issues first, open an issue before starting a large change, match the existing code style, and test on real Samsung or LG hardware where you can. See [Development](https://github.com/Moonfin-Client/Smart-TV/wiki/Development) for how the codebase is laid out and how platform-specific code is kept isolated.

To submit a change, fork the repo, create a feature branch, make your changes with clear commit messages, and open a pull request with a clear description.

## Help translate Moonfin [here](https://translate.moonfin.io/engage/smart-tv/)

<a href="https://translate.moonfin.io/engage/smart-tv/">
  <img
    src="https://translate.moonfin.io/widgets/smart-tv/-/multi-auto.svg"
    alt="Moonfin SmartTV translation status by language"
  />
</a>

## Support and Community

- **Issues** for bugs and feature requests: [GitHub Issues](https://github.com/Moonfin-Client/Smart-TV/issues)
- **Discussions** for questions and ideas: [GitHub Discussions](https://github.com/Moonfin-Client/Smart-TV/discussions)
- **Jellyfin** for server-related questions: [jellyfin.org](https://jellyfin.org)

## Credits

Moonfin is built on the work of others:

- **[Jellyfin Project](https://jellyfin.org)** for the media server
- **[Enact](https://enactjs.com)** for the React-based framework for TV apps
- **Jellyfin Tizen and webOS Contributors** for the original clients
- **Moonfin Contributors** for everything they have added to the project

## License

This project is licensed under the MPL 2.0 license. Some parts incorporate content licensed under the Apache 2.0 license. All images are taken from and licensed under the same license as https://github.com/jellyfin/jellyfin-ux. See the [LICENSE](LICENSE) file for details.

---
<p align="center">
   <strong>Moonfin for Smart TVs</strong> is an independent client and is not affiliated with the Jellyfin or Emby projects.<br>
   <a href="https://github.com/Moonfin-Client">Back to main Moonfin project</a>
</p>

---

## About this fork

This is a personal fork of [Moonfin for Smart TVs](https://github.com/Moonfin-Client/Smart-TV), modified by me ([Licaa21](https://github.com/Licaa21)) for my own use. Moonfin itself is made by **RadicalMuffinMan** and the Moonfin contributors, and all credit for the app belongs to them. This fork follows upstream `main` and adds the changes below on top. It isn't an official build, and the changes aren't promised to ever reach upstream.

### What I added

**Playback**
- **Standby recovery on Tizen:** playback comes back after the TV sleeps, goes to the background or is powered off, instead of leaving a black screen.
- **Force Compatible AV1 Transcode:** an opt-in setting that re-encodes AV1 to HEVC when transcoding, for Tizen sets that fail on AV1 over fragmented-MP4 HLS.
- **Channel keys:** CH +/- seek far, by five times the seek step or 3% of the runtime, wherever focus is. Previous plays the previous episode, and the TV's own channel, guide and streaming-service keys no longer close the app.
- **Seeking lands by itself:** a held seek is applied about half a second after you stop, without pressing OK.
- **Episode browser:** an Episodes button in the player opens the current season on the playing episode, with season tabs, CH +/- to change season, and resume on pick. It can be arranged in Player Buttons.
- **Skip prompt:** its auto-hide starts over for every episode, so it no longer vanishes early after Previous or Next.
- **Seek bar:** the focused thumb is easier to see on Tizen.

**Subtitles and audio**
- **Preferred Languages** subtitle mode: your preferred language, then your secondary one, and off when neither is in the file.
- **Audio Codec Priority:** rank codecs from best to worst, applied after your audio language.
- **Details buttons:** the Audio and Subtitle buttons show the track playback will actually start on.

**Look and layout**
- **Accent colors:** a color per part of the app, or one for everything, with focus fills kept readable.
- **Skip Intro/Recap/Credits editor:** capsule, rectangle and sweep layouts with position, size, colors and a live preview, plus card, banner and button layouts for the Next Episode prompt.
- **Search:** results drawn with the Home cards and rows, best matches first, and a setting for which tab a search opens on when Seerr has results.
- **Person pages:** redesigned with a portrait, backdrop and de-duplicated credits.
- **Details:** action button rows ranked like Settings, "Read more" only when the text is cut off, anime marker pills on every layout, and a Press BACK to close hint on trailers.

**Diagnostics and translations**
- **Diagnostic log:** the in-app log keeps its recent non-network lines across restarts, so a report still has them after the app reopens.
- **Romanian:** strings added by this fork are translated by hand in `packages/app/resources/ro/strings.json`, since this fork has no Weblate project.

### Branches and updating

- `main` follows upstream Moonfin and differs from it only by this README, which is shown first on GitHub.
- `implement` is where my changes live. They are committed here and nowhere else.
- `daily` is `main` merged with `implement`, and it is only used to build the app for daily use. Nothing is committed on it by hand.
- `feature/episodeselector-skipperlayout-accentcolors` is the one change proposed upstream (the in-player episode browser, [#494](https://github.com/Moonfin-Client/Smart-TV/pull/494)).
- To pick up upstream's latest, run `bash fork-tools/update-daily.sh` on `daily`, then `bash fork-tools/build-daily-wgt.sh`. The Tizen package is the regular build, named after the upstream one with `_Lica_Fork` added, for example `Moonfin_Tizen_Regular_2.9.0_Lica_Fork.wgt`.
