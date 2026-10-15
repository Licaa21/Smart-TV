# TODO

Done, waiting for the TV test:

- Theme song with a trailer opened from a library title's details screen: it fades out for the trailer and comes back when the trailer is closed. A local trailer that goes through the player was not changed, since the theme already came back from there in the code.
- Refreshing Home: pressing Home in the navigation while Home is open reloads it, the library scan button refreshes Home when the server has finished the scan, and pressing Seerr while Discover is open reloads Discover.

Open, one thing to check on the TV: the scan watcher asks the server whether the "Scan Media Library" task is running. If Jellyfin does the scan inside the request instead of as that task, Home refreshes about 3 seconds after the button is pressed, which may be before the scan has found everything.

Confirmed, nothing changed: PGS and ASS subtitles are drawn on their own full-screen canvas, so the lift for the controls and the description, and the subtitle size, color, background, shadow and opacity settings, only reach plain-text subtitles.
