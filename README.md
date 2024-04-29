# TwitchAdOverlay
Displays an overlay whenever a twitch ad is about to play. For use as an alternative to having to download and run Streamer.bot.

This code originally came from a widget made by [nutty](https://www.youtube.com/watch?v=e5B7ZNGtkac). While this code supports the old method of just using Streamer.bot via StreamElements, it can also be ran locally within OBS, avoiding the necessity of external programs and services. If you use the PubSub Twitch option, you cannot host the file as a StreamElements widget, as their CORS policy does not allow for connections to the Twitch backend.

## Setup

This will be going over how to run the system locally rather than via StreamElements and Streamer.bot. That setup is covered by the video nutty made.

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

If you've already saved a `config.js` and placed it in the right place.

You just need to generate a new OAuth Token. This is required by Twitch from time to time. You can just simply open the html file in your browser and Generate New OAuth Token. Then just Save Data.

Because you've entered your `client id` and Twitch channel name previously, you shouldn't be prompted for it again.

---

## Credits

* Ding sound from Free Sounds user LittleRainySeasons (public domain): https://freesound.org/people/LittleRainySeasons/sounds/335908/
* Ads playing soon sound from Free Sounds user (Joao_Janz) under CreativeCommons: https://freesound.org/people/Joao_Janz/sounds/478513/
* Original Streamer.Bot/StreamElements overlay code by: [nutty](https://www.youtube.com/@nuttylmao)
* PubSub event snooping by [TwitchLib](https://github.com/TwitchLib/TwitchLib.PubSub/blob/master/TwitchLib.PubSub/Models/Responses/Messages/VideoPlayback.cs#L12) and [twitch_api2](https://docs.rs/twitch_api2/0.6.1/src/twitch_api2/pubsub/video_playback.rs.html#14-17)
* IsNumeric from [this stackoverflow answer](https://stackoverflow.com/a/175787)
