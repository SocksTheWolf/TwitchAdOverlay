# TwitchAdOverlay
Displays an overlay whenever a Twitch ad is about to play.

This code originally came from a widget made by [nutty](https://www.youtube.com/watch?v=e5B7ZNGtkac) but has been modified to run locally instead.

## Setup

1. Create a new application via [Twitch developer console](https://dev.twitch.tv/console). This will give you a `client id` that you will use later.

	**NOTE:** Make sure your redirect URL is properly set on the developer console to include the URIs `http://localhost` and `https://twitchapps.com/tokengen/`
2. Open the `index.html` file in your usual browser. You'll see two buttons at the top: "Generate new OAuth Token" and "Save Data".
3. Click "Generate new OAuth Token". If you've never set your config before, the file will ask you for the `client id` you got in step 1.
4. Go through the OAuth process, you'll be redirected to login with Twitch. You may get a prompt that the file tried to open a new window, allow it to do so.
5. Copy the output value from the site (this is your `OAuth Token`) and then press the "Save Data" button.
6. Input the value of the `OAuth Token` you have just generated in step 5.
7. Input the valid of your `client id` from step 1.
8. Input the channel name of your Twitch account.
9. A file named `config.js` will be generated and you'll be prompted to save it. Make sure to place it in the folder with your index.html!
10. You can make any other changes you wish to modify the general look and feel of things via `config.js`, but generally you don't have to do anything further with it.
11. Refresh the html file. If it shows the green "Connected!", then you have followed the steps properly! You can copy the URL of the html file from your browser navigation bar.
12. Create a new browser scene in OBS, paste the URL to your html file from step 11.
13. You will now get ad overlays and a notification ding (remember to have your browser source also control audio through OBS and monitor that sound channel) whenever you get ads playing on your channel.


## FAQ

### The Ad Overlay never connects or isn't alerting

Check if you've already saved a `config.js` and placed it in the right place. You'll know you did it right if you ever saw a green "Connected" message.

If you have seen the green message before, then you likely just need to generate a new OAuth Token. This is required by Twitch from time to time. You can just simply open the html file in your browser and Generate New OAuth Token. Then just Save Data.

Because you've entered your `client id` and Twitch channel name previously, you shouldn't be prompted for it again.

### How to change the audio alerts that play?

The audio files are located in the `sounds` folder, and can be swapped with any sound so long as it is an MP3 file named like the below list. It is recommended to use files that are small in size.

- `adsIncoming` = Plays whenever automated ads are about to begin, based off the value set for `aheadOfTimeAlert` minutes.
- `adsPlaying` = Plays when the ads actually start appearing on your channel.

### I snoozed an ad play, why does the widget still show Ads Starting Soon?

There's no setting in the Twitch API that allows for querying that an ad is snoozed, so this is a limitation of the Twitch backend.

---

## Credits

* [Ding sound](https://freesound.org/people/LittleRainySeasons/sounds/335908/) from FreeSound user LittleRainySeasons under CC0
* [Ads playing soon sound](https://freesound.org/people/Joao_Janz/sounds/478513/) from FreeSound user (Joao_Janz) under CC0
* Original Streamer.Bot/StreamElements overlay code by [nutty](https://www.youtube.com/@nuttylmao)
* PubSub event snooping by [TwitchLib](https://github.com/TwitchLib/TwitchLib.PubSub/blob/master/TwitchLib.PubSub/Models/Responses/Messages/VideoPlayback.cs#L12) and [twitch_api2](https://docs.rs/twitch_api2/0.6.1/src/twitch_api2/pubsub/video_playback.rs.html#14-17)
* IsNumeric from [this stackoverflow answer](https://stackoverflow.com/a/175787)
* [TES library](https://github.com/mitchwadair/tesjs) for EventSub by mitchwadair
