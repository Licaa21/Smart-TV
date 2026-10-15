# TODO

Done, waiting for the TV test:

- Theme song with a trailer opened from a library title's details screen: it fades out for the trailer and comes back when the trailer is closed.
- Refreshing Home: pressing Home in the navigation while Home is open reloads it, the library scan button refreshes Home when the server has finished the scan, and pressing Seerr while Discover is open reloads Discover.
- PGS and ASS subtitles move up with the controls and the pause description. PGS has its own settings (size, position, opacity, brightness, and a background box with a color and opacity) under Subtitle Customization, and the player's Subtitle Appearance button follows the loaded track: PGS options for PGS, a note for ASS, the text options otherwise. The webOS player only gets the lift for ASS.

Open, one thing to check on the TV: the scan watcher asks the server whether the "Scan Media Library" task is running. If Jellyfin does the scan inside the request instead of as that task, Home refreshes about 3 seconds after the button is pressed, which may be before the scan has found everything.
