# TwitchAdOverlay

Displays an overlay whenever a Twitch ad is about to play.

This code originally came from a widget made by [nutty](https://www.youtube.com/watch?v=e5B7ZNGtkac) but has been modified to run locally instead.

## Setup

1. Download the [latest release](https://github.com/SocksTheWolf/TwitchAdOverlay/releases/latest) (click the Source Code zip option), unzip that file somewhere easy to remember.
2. Open the `index.html` file in your usual browser. You'll see two buttons at the top: "Get User Login Token" and "Save Data".
3. Click "Get User Login Token". Go through the website service and get your new token!
4. Click "Save Data" and paste the value that you got in the last step. A file named `config.js` will be generated and you'll be prompted to save it. Make sure to place it in the folder with your `index.html`!
5. [OPTIONAL] You can make any other changes you wish to modify the general look and feel of things via `config.js`, but generally you don't have to do anything further with it.
6. Refresh the html file in your browser. If it shows the green "Connected!", then you have followed the steps properly! You can copy the URL of the html file from your browser navigation bar.
7. Create a new browser scene in OBS, paste the URL to your html file from the last step. **NOTE**: Do not use the "Local File" checkbox in OBS, it will not work.
8. You will now get ad overlays and a notification ding (remember to have your browser source also control audio through OBS and monitor that sound channel) whenever you get ads playing on your channel.

## FAQ

### The Ad Overlay never connects or isn't alerting

Check if you've already saved a `config.js` and placed it in the right place. You'll know you did it right if you ever saw a green "Connected" message.

### How to change the audio alerts that play?

The audio files are located in the `sounds` folder, and can be swapped with any sound so long as it is an MP3 file named like the below list. It is recommended to use files that are small in size.

- `adsIncoming` = Plays whenever automated ads are about to begin, based off the value set for `aheadOfTimeAlert` minutes.
- `adsPlaying` = Plays when the ads actually start appearing on your channel.

### I snoozed an ad play, why does the widget still show Ads Starting Soon?

There's no setting in the Twitch API that allows for querying that an ad is snoozed, so this is a limitation of the Twitch backend.

---

## Credits

- [Ding sound](https://freesound.org/people/LittleRainySeasons/sounds/335908/) from FreeSound user LittleRainySeasons under CC0
- [Ads playing soon sound](https://freesound.org/people/Joao_Janz/sounds/478513/) from FreeSound user (Joao_Janz) under CC0
- Original Streamer.Bot/StreamElements overlay code by [nutty](https://www.youtube.com/@nuttylmao)
- IsNumeric from [this stackoverflow answer](https://stackoverflow.com/a/175787)
- [TES library](https://github.com/mitchwadair/tesjs) for EventSub by mitchwadair
