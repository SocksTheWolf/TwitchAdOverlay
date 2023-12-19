/////////////////
// GLOBAL VARS //
/////////////////
let ws;
let sbAdRun;
let sbAdMidRoll;
let midRollTimerObject = null;
let pollForNextAdBreakTimer = null;
let adAlertForNextAdTimer = null;
let hasStarted = false;
const twitchPubSubServer = "wss://pubsub-edge.twitch.tv";
const twitchHelixUsersEndpoint = "https://api.twitch.tv/helix/users?login=";
const twitchHelixAdEndpoint = "https://api.twitch.tv/helix/channels/ads?broadcaster_id=";

///////////////////
// CONFIG FIELDS //
///////////////////
let debugMode = false;
let barColor = "#a970ff";
let noticeText = "Twitch Ad Break";
let noticeColor = "#ffffff";
let lineThickness = 10;
let barPosition = "bottom";			// None, Bottom, Top, Left, Right
let timerPosition = "Top Left";		// None, Top Left, Top Right, Bottom Left, Bottom Right
let singleAdLength = 30;
let usingTwitch = true;
let playAudioOnAd = true;
let twitchUserID = "";
let twitchUserName = "";
let twitchClientId = "";
// Needs scopes: channel:edit:commercial channel:read:ads channel_commercial channel_read
let twitchOAuthToken = "";
let showMidRollCountdown = "No";	// No, Yes
let aheadOfTimeAlert = 3; // Ahead of time countdown (in minutes)
let pollForNextAdRate = 5; // Polling for next ad rate (in minutes)

/////////////////////
// SB ONLY CONFIGS //
/////////////////////
let sbServerAddress = "127.0.0.1";
let sbServerPort = "8080";
let testDuration = 5;

/////////////////////
// CONFIG PARSING //
////////////////////
function GetBooleanValueFromSettings(setting) {
	if (typeof(setting) === "string") {
		var LowerString = setting.toLowerCase();
		return LowerString === "yes" || LowerString == "on";
	}
	else
		return setting;
}

function SetConfigFromBlob(fieldData) {	
	debugMode = GetBooleanValueFromSettings(fieldData.debugMode);
	usingTwitch = GetBooleanValueFromSettings(fieldData.usingTwitch);
	barColor = fieldData.barColor;
	noticeColor = fieldData.noticeColor;
	if (isNumeric(fieldData.lineThickness))
		lineThickness = Number(fieldData.lineThickness);
	
	barPosition = fieldData.barPosition.toLowerCase();
	timerPosition = fieldData.timerPosition.toLowerCase();

	usingTwitch = GetBooleanValueFromSettings(fieldData.usingTwitch);
	playAudioOnAd = GetBooleanValueFromSettings(fieldData.playAudioOnAd);
	showMidRollCountdown = GetBooleanValueFromSettings(fieldData.showMidRollCountdown);
	aheadOfTimeAlert = fieldData.aheadOfTimeAlert;
	pollForNextAdRate = fieldData.pollForNextAdRate;
	twitchUserName = fieldData.twitchUserName.trim();
	twitchClientId = fieldData.twitchClientId.trim();
	if (isNumeric(fieldData.singleAdLength))
		singleAdLength = Number(fieldData.singleAdLength);
	twitchOAuthToken = fieldData.twitchOAuthToken.trim();
	noticeText = fieldData.noticeText;
}

function TwitchSettingsValid() {
	if (usingTwitch) {
		if (twitchClientId.length == 0) {
			console.warn("Twitch client id is missing!");
			return false;
		} else if (twitchOAuthToken.length == 0) {
			console.warn("Twitch OAuth Token is missing!!");
			return false;
		} else {
			console.log("Twitch config checks out");
		}
	}
	return true;
}

// Load up settings from the config system
try {
	console.log("Attempting to read local data config");
	SetConfigFromBlob(configData);
	
	if (!TwitchSettingsValid())
		throw "Bad Twitch Settings";
	
} catch (error) {
	if (IsHostedLocally()) {
		console.error("Attempted to run file locally but missing config!!");
		throw "Check config file and settings!";
	} else {
		console.log("A config file does not exist. Might be running from StreamElements?");
	}
}

// Get the user's channel id if we're using twitch!
if (usingTwitch) {
	const helixLookup = twitchHelixUsersEndpoint + twitchUserName;
	let xhr = new XMLHttpRequest();
	xhr.open("GET", helixLookup, false);
	xhr.setRequestHeader("Authorization", "Bearer "+twitchOAuthToken);
	xhr.setRequestHeader("Client-Id", twitchClientId);
	
	xhr.onload = (e) => {
	  if (xhr.readyState === 4) {
		if (xhr.status === 200) {
		  const responseJson = JSON.parse(xhr.responseText);
		  twitchUserID = responseJson.data[0].id;
		} else {
		  console.error(xhr.statusText);
		}
	  }
	};
	xhr.onerror = (e) => {
	  console.error(xhr.statusText);
	};
	xhr.send();
}

///////////////////////////////////
// SRTEAMER.BOT WEBSOCKET SERVER //
///////////////////////////////////

// This is the main function that connects to the Streamer.bot websocket server
function ConnectStreamerBotWS() {
	if ("WebSocket" in window) {
		ws = new WebSocket("ws://" + sbServerAddress + ":" + sbServerPort + "/");

		// Reconnect
		ws.onclose = function () {
			SetConnectionStatus(false);
			setTimeout(ConnectStreamerBotWS, 5000);
		};

		// Connect
		ws.onopen = async function () {
			SetConnectionStatus(true);

			console.log("Subscribe to events");
			ws.send(
			JSON.stringify({
				request: "Subscribe",
				id: "subscribe-events-id",
				events: {
					// This is the list of Streamer.bot websocket events to subscribe to
					// See full list of events here:
					// https://wiki.streamer.bot/en/Servers-Clients/WebSocket-Server/Requests
					twitch: [
						"AdRun",
						"AdMidRoll"
					]}
				})
			);

			ws.onmessage = function (event) {
				// Grab message and parse JSON
				const msg = event.data;
				const wsdata = JSON.parse(msg);

				if (typeof(wsdata.event) == "undefined")
					return;

				// Print data to log for debugging purposes
				if (debugMode) {
					console.log(wsdata.data);
					console.log(wsdata.event.type);
				}

				// Check for events to trigger
				// See documentation for all events here:
				// https://wiki.streamer.bot/en/Servers-Clients/WebSocket-Server/Events
				switch (wsdata.event.source) {
					// Twitch Events
				case 'Twitch':
					switch (wsdata.event.type) {
					case ('AdRun'):
						sbDoAction(ws, sbAdRun, wsdata.data);
						AdRun(wsdata.data);
						break;
					case ('AdMidRoll'):
						sbDoAction(ws, sbAdMidRoll, wsdata.data);
						AdMidRoll(wsdata.data);
						break;
					}
					break;

				}
			};
		}
	}
}

//////////////////////////
// TWITCH PUBSUB SYSTEM //
//////////////////////////

function RunTwitchPubSub() {
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
		if (debugMode)
			console.log(event);

		var message = JSON.parse(event.data);
		if (message.type == "RECONNECT") {
			console.log("force reconnection!");
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
				} else if (debugMode) {
					console.log(internalMessage.type);
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
				topics: ["video-playback-by-id." + twitchUserID/*, "ads-manager."+twitchUserID+"."+twitchUserID*/],
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

///////////////////////
// TWITCH AD OVERLAY //
///////////////////////

function AdRun(data) {
	console.log("Ads are to be running at length " + data.length);
	TimerBarAnimation(data.length);
	HugeTittiesAnimation(data.length);
	EnqueueNextScheduleAdPoll();
}

function ClearTimerForObject(inTimerToClear) {
	if (inTimerToClear != null) {
		window.clearTimeout(inTimerToClear);
		inTimerToClear = null;
	}
}

function EnqueueNextScheduleAdPoll(ShouldGoNow=false) {
	// If we're allowed to show the midroll countdown, start polling.
	if (!showMidRollCountdown)
		return;

	// Clear Ad Poll Timer
	ClearTimerForObject(pollForNextAdBreakTimer);
	if (ShouldGoNow)
		PollAdSchedule();
	else
		pollForNextAdBreakTimer = setTimeout(PollAdSchedule, 1000 * 60 * pollForNextAdRate);
}

function SetTimeoutForAdAlert(TimeInMs) {
	ClearTimerForObject(adAlertForNextAdTimer);
	adAlertForNextAdTimer = setTimeout(AdMidRoll, TimeInMs);
}

function PollAdSchedule() {	
	const helixLookup = twitchHelixAdEndpoint + twitchUserID;
	let xhr = new XMLHttpRequest();
	xhr.open("GET", helixLookup, true);
	xhr.setRequestHeader("Authorization", "Bearer "+twitchOAuthToken);
	xhr.setRequestHeader("Client-Id", twitchClientId);
	
	xhr.onload = (e) => {
	  if (xhr.readyState === 4) {
		if (xhr.status === 200) {
		  const responseJson = JSON.parse(xhr.responseText);
		  // console log this for safety
		  console.log(responseJson);
		  // Cast timestamp into Date object
		  const responseTimeStamp = responseJson.data[0].next_ad_at;
		  var NextAdTime = 0;
		  if (typeof(responseTimeStamp) === "string")
		  	NextAdTime = Date.parse(responseTimeStamp);
		  else
			NextAdTime = responseTimeStamp * 1000; // Twitch may return as seconds
		  // Subtract some offset so we can be alerted ahead of time
		  // Create a new Date object
		  NextAdTime = new Date(new Date(NextAdTime) - (aheadOfTimeAlert * 60 * 1000));
		  const TimeUntilNextAlertInMs = NextAdTime - Date.now();
		  // Set another poll event for the next time to poll
		  EnqueueNextScheduleAdPoll();
		  // Set timer for next ad via the nextadtime
		  SetTimeoutForAdAlert(TimeUntilNextAlertInMs);
		} else {
		  console.error(xhr.statusText);
		  EnqueueNextScheduleAdPoll();
		}
	  }
	};
	xhr.onerror = (e) => {
	  console.error(xhr.statusText);
	  EnqueueNextScheduleAdPoll();
	};
	xhr.send();
}

function AdMidRoll(data) {
	if (!showMidRollCountdown)
		return;

	MidRollAnimation(aheadOfTimeAlert*60);
	if (playAudioOnAd) {
		let audioPing = document.getElementById("adMidrollStartingNoise");
		audioPing.play();
	}
}

function TimerBarAnimation(adLength) {
	let timerBar = document.getElementById("timerBar");

	// Set style
	timerBar.style.background = barColor;
	timerBar.style.position = "absolute";
	
	switch (barPosition.toLowerCase()) {
	case "none":
		timerBar.style.display = "none";
		break;
	default:
	case "bottom":
		timerBar.style.height = lineThickness + "px";
		timerBar.style.bottom = "0px";
		timerBar.style.left = "0px";

		// Start Animation
		tl = new TimelineMax();
		tl.to(timerBar, 0.5, { width: window.innerWidth + "px", ease: Cubic.ease })
			.to(timerBar, adLength, { width: "0px", ease: Linear.easeNone })
		break;

	case "top":
		timerBar.style.height = lineThickness + "px";
		timerBar.style.top = "0px";
		timerBar.style.left = "0px";

		// Start Animation
		tl = new TimelineMax();
		tl.to(timerBar, 0.5, { width: window.innerWidth + "px", ease: Cubic.ease })
			.to(timerBar, adLength, { width: "0px", ease: Linear.easeNone })
		break;

	case "left":
		timerBar.style.width = lineThickness + "px";
		timerBar.style.bottom = "0px";
		timerBar.style.left = "0px";

		// Start Animation
		tl = new TimelineMax();
		tl.to(timerBar, 0.5, { height: window.innerHeight + "px", ease: Cubic.ease })
			.to(timerBar, adLength, { height: "0px", ease: Linear.easeNone })
		break;

	case "right":
		timerBar.style.width = lineThickness + "px";
		timerBar.style.bottom = "0px";
		timerBar.style.right = "0px";

		// Start Animation
		tl = new TimelineMax();
		tl.to(timerBar, 0.5, { height: window.innerHeight + "px", ease: Cubic.ease })
			.to(timerBar, adLength, { height: "0px", ease: Linear.easeNone })
		break;
	}
}

function HugeTittiesAnimation(adLength) {
	let hugeTittiesContainer = document.getElementById("hugeTittiesContainer");
        let timerPosLower = timerPosition.toLowerCase();
	switch (timerPosLower) {
	case "none":
		hugeTittiesContainer.style.display = "none";
		break;
	default:
	case "top left":
		hugeTittiesContainer.style.top = "0px";
		hugeTittiesContainer.style.left = "0px";
		break;
	case "top right":
		hugeTittiesContainer.style.top = "0px";
		hugeTittiesContainer.style.right = "0px";
		break;
	case "bottom left":
		hugeTittiesContainer.style.bottom = "0px";
		hugeTittiesContainer.style.left = "0px";
		break;
	case "bottom right":
		hugeTittiesContainer.style.bottom = "0px";
		hugeTittiesContainer.style.right = "0px";
		break;
	}
	
	// Set the color for the background box
	let labelColor = document.getElementById("label");
	labelColor.style.background = barColor;
	labelColor.style.color = noticeColor;

	// Calculate starting time
	let startingTime = adLength % singleAdLength;
	if (startingTime == 0)
		startingTime = singleAdLength;

	// Estimate how many ads there should be
	let adsTotal = Math.ceil(adLength / singleAdLength);
	let adsRemaining = 1;

	// Start the countdown timer
	let adsRemainingContainer = document.getElementById("adsRemainingContainer");
	let timerContainer = document.getElementById("timerContainer");
	
	if (playAudioOnAd) {
		let audioPing = document.getElementById("adAudioNoise");
		audioPing.play();
	}

	var timerThingy = setInterval(function () {
		startingTime--;
		if (startingTime == 0 && adsRemaining < adsTotal) {
			adsRemaining++;
			startingTime = singleAdLength;
		}
		if (startingTime == 0 && adsRemaining == adsTotal) {
			clearInterval(timerThingy);
			SetVisibility(false);
			return;
		}
		adsRemainingContainer.innerText = adsRemaining + " of " + adsTotal;
		timerContainer.innerText = startingTime.toString().toHHMMSS();

		// Show the widget
		SetVisibility(true);
	}, 1000)
}

function MidRollAnimation(countdownLength) {
	let midRollContainer = document.getElementById("midRollContainer");
	let midRollCountdownContainer = document.getElementById("midRollCountdownContainer");
	let width = midRollContainer.getBoundingClientRect().width;
	
	// Set the starting position of the countdown box
	midRollContainer.style.right = -width + "px";
	midRollCountdownContainer.innerHTML = countdownLength;

	// Slide the countdown box on screen
	ShowMidRollCountdown(true);

	// Start the countdown timer
	let startingTime = countdownLength;

	midRollTimerObject = setInterval(function () {
		startingTime--;
		midRollCountdownContainer.innerText = startingTime;
		if (startingTime == 0) {
			ShowMidRollCountdown(false);
			return;
		}
	}, 1000)
}

function SetVisibility(isVisible) {
	if (isVisible)
		ShowMidRollCountdown(false);

	let hugeTittiesContainer = document.getElementById("hugeTittiesContainer");
	var tl = new TimelineMax();
	tl.to(hugeTittiesContainer, 0.5, { opacity: isVisible, ease: Linear.easeNone });
}

function ShowMidRollCountdown(isVisible) {
	if (midRollTimerObject != null) {
		clearInterval(midRollTimerObject);
		midRollTimerObject = null;
	}
	
	let midRollContainer = document.getElementById("midRollContainer");
	let width = midRollContainer.getBoundingClientRect().width;
	var tl = new TimelineMax();

	if (isVisible) {
		tl.to(midRollContainer, 0.5, { right: "-10px", ease: Power1.easeInOut })
	} else {
		tl.to(midRollContainer, 0.5, { right: -width + "px", ease: Power1.easeInOut })
	}
}

//////////////////////
// HELPER FUNCTIONS //
//////////////////////

function sbDoAction(ws, actionName, data) {
	if (usingTwitch)
		return;

	let request = JSON.stringify({
		request: "DoAction",
		id: "subscribe-do-action-id",
		action: {
			name: actionName
		},
		args: {
			data
		}
	});
	ws.send(request);
}

function IsHostedLocally() {
	return location.protocol === "file:";
}

// Taken from StackOverflow: https://stackoverflow.com/a/175787
function isNumeric(str) {
	var curType = typeof(str);
	if (curType == "number")
		return true;
	else if (curType != "string") 
		return false; // we only process strings!
	return !isNaN(str) && !isNaN(parseFloat(str));
}

String.prototype.toHHMMSS = function () {
	var sec_num = parseInt(this, 10); // don't forget the second param
	var hours = Math.floor(sec_num / 3600);
	var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
	var seconds = sec_num - (hours * 3600) - (minutes * 60);

	if (hours < 10) { hours = "0" + hours; }
	//if (minutes < 10) {minutes = "0"+minutes;}
	if (seconds < 10) { seconds = "0" + seconds; }
	//return hours+':'+minutes+':'+seconds;
	return minutes + ':' + seconds;
}

function RunOverlay() {
	if (hasStarted)
		return;
	
	let noticeTextFix = document.getElementById("label");
	noticeTextFix.innerHTML = noticeText;
	hasStarted = true;
	
	if (usingTwitch) {
		console.log("Using Twitch PubSub");
		RunTwitchPubSub();
	} else {
		console.log("Using streamerbot");
		ConnectStreamerBotWS();
	}
}

function SetConnectionStatus(connected) {
	let statusContainer = document.getElementById("statusContainer");
	if (connected) {
		statusContainer.style.background = "#2FB774";
		statusContainer.innerText = "Connected!";
		var tl = new TimelineMax();
		tl.to(statusContainer, 2, { opacity: 0, ease: Linear.easeNone })
		//.call(removeElement, [div]);
	} else {
		statusContainer.style.background = "#D12025";
		statusContainer.innerText = "Connecting...";
		statusContainer.style.opacity = 1;
	}
}

///////////////////////////
// STREAMELEMENTS EVENTS //
///////////////////////////

window.addEventListener('onWidgetLoad', function (obj) {
	const fieldData = obj.detail.fieldData;
	SetConfigFromBlob(fieldData);
	sbServerAddress = fieldData.sbServerAddress;
	sbServerPort = fieldData.sbServerPort;
	sbAdRun = fieldData.sbAdRun;
	sbAdMidRoll = fieldData.sbAdMidRoll;
	aheadOfTimeAlert = fieldData.aheadOfTimeAlert;
	pollForNextAdRate = fieldData.pollForNextAdRate;
	showMidRollCountdown = GetBooleanValueFromSettings(fieldData.showMidRollCountdown);
	testDuration = fieldData.testDuration;
	RunOverlay();
});

window.addEventListener('onEventReceived', function (obj) {
	const listener = obj.detail.listener;
	// Handling widget buttons
	if (obj.detail.event) {
		if (obj.detail.event.listener === 'widget-button') {
			if (obj.detail.event.field === 'testButtonAdWidget') {
				const data = { length: testDuration };
				sbDoAction(ws, sbAdRun, data);
				AdRun(data);
			}
			if (obj.detail.event.field === 'testButtonAdMidRoll') {
				const data = { length: 5 };
				sbDoAction(ws, sbAdMidRoll, data);
				AdMidRoll(data);
			}
			return;
		}
	}
});

if (IsHostedLocally())
	RunOverlay()
