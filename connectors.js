function RunTwitchEventSub() {
	// Prevent us running eventsub if the oauth token/channel id is not resolvable.
	if (twitchUserID.length === 0)
		return;
	
	let eventSub = new TES({listener: { type: "websocket" }, identity: {
		id: twitchClientId,
		accessToken: twitchOAuthToken,
	}});
	
	eventSub.on("channel.ad_break.begin", event => {
		AdRun({length: event.duration_seconds});
	});
	
	eventSub.subscribe("channel.ad_break.begin", {
		broadcaster_user_id: twitchUserID,
	}).then(() => {
		console.log("Adbreak Subscription Successful");
		SetConnectionStatus(true);
		EnqueueNextScheduleAdPoll(true);
	}).catch(err => {
		console.log(err);
		SetConnectionStatus(false);
	});
	
	eventSub.on("revocation", subscription => {
		console.error("Subscription was revoked due to " + subscription.status);
		SetConnectionStatus(false);
	});
}

function RunTwitchPubSub() {
	// Prevent us running pubsub if the oauth token/channel id is not resolvable.
	if (twitchUserID.length === 0)
		return;
	
	const twitchPubSubServer = "wss://pubsub-edge.twitch.tv";
	var awaiting_pong = false;
	let PingPong;
	let PubSub = new WebSocket(twitchPubSubServer);

	function ForcePubSubReconnect() {
		awaiting_pong = false;
		SetConnectionStatus(false);
		PubSub.close();
		PubSub = new WebSocket(twitchPubSubServer);
	}

	PubSub.onmessage = function(event) {
		var message = JSON.parse(event.data);
		if (message.type == "RECONNECT") {
			console.log("force reconnection!");
			SetConnectionStatus(false);
			ForcePubSubReconnect();
		} else if (message.type == "PONG") {
			awaiting_pong = false;
			console.log("Got PONG");
		} else if (message.type == "RESPONSE") {
			if (message.error) {
				console.error("Encountered a twitch error: "+message.error);
			} else {
				console.log("Connected!");
				SetConnectionStatus(true);
				EnqueueNextScheduleAdPoll(true);
			}
		} else if (message.data === "undefined") {
			console.log("Message data was undefined: "+message);
		} else if (message.type == "MESSAGE") {
			var internalMessage = JSON.parse(message.data.message);
			switch (message.data.topic.slice(0, -1 * (twitchUserID.length+1))){
			case 'video-playback-by-id':
				if (internalMessage.type == "commercial") {
					AdRun(internalMessage);
				}
				break;
			default:
				console.log("Unhandled Function")
			}
		}	
	}

	PubSub.onopen = function(event) {
		PubSub.send(JSON.stringify({
			type: "LISTEN",
			data: {
				topics: ["video-playback-by-id." + twitchUserID],
				auth_token: twitchOAuthToken
			}
		}))
		PingPong = setInterval(() => {
			if (PubSub.readyState == 2 || PubSub.readyState == 3) {
				// Websocket is closing, let's reconnect instead
				ForcePubSubReconnect();
			} else {
				PubSub.send(JSON.stringify({type:"PING"}));
				awaiting_pong = true;

				// Response not received within 15s time
				setTimeout(() => {
					if (awaiting_pong) {
						awaiting_pong = false;
						ForcePubSubReconnect();
					}
				}, 1000 * 15);
			}
		}, 1000 * 60 * 3);
	}

	PubSub.onclose = function(event) {
		if (PingPong !== "undefined") {
			clearInterval(PingPong);
		}
		ForcePubSubReconnect();
	}
}