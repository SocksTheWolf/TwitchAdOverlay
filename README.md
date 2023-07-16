# TwitchAdOverlay
Displays an overlay whenever a twitch ad is about to play. For use as an alternative to having to download and run Streamer.bot

This code originally came from a widget made by [nutty](https://www.youtube.com/watch?v=e5B7ZNGtkac). While this code supports the old method of just using Streamer.bot via Streamelements, it can also be ran locally.

Setup will go over how to run it locally.

## Setup

1. Create a new application via Twitch developer console. This will give you a client id.
2. Go generate an OAuth token for your new client id. You will need the following scopes: `channel:edit:commercial channel_commercial channel_read`
3. In script.js, modify the line: `let twitchOAuthToken = "";` to equal the new oauth token you have generated.
4. Grab your twitch channel id. This will be a numeric value. You need this so you can properly subscribe to the advertisement messaging for your channel.
5. Insert this number in between the quote marks in script.js for `let twitchUserID = "";`
6. Save the changes to script.js
7. Create a new browser scene in OBS, point it to your file.
8. You will now get ad overlays and a notification ding (remember to have your browser source also control audio through OBS and monitor that sound channel) whenever you get ads playing on your channel.
