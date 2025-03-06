/////////////////
// GLOBAL VARS //
/////////////////
let midRollTimerObject = null;
let pollForNextAdBreakTimer = null;
let adAlertForNextAdTimer = null;
let hasStarted = false;
const usingEventSub = true;
const twitchAuthLink = "https://make.twitchauth.work/login?template=07ef212b-ecd0-48a0-8392-bc28a2aa20a4";
const twitchHelixUsersEndpoint = "https://api.twitch.tv/helix/users?login=";
const twitchHelixAdEndpoint = "https://api.twitch.tv/helix/channels/ads?broadcaster_id=";

///////////////////
// CONFIG FIELDS //
///////////////////
let barColor = "#a970ff";
let noticeText = "Twitch Ad Break";
let noticeColor = "#ffffff";
let lineThickness = 10;
let barPosition = "bottom";			// None, Bottom, Top, Left, Right
let timerPosition = "Top Left";		// None, Top Left, Top Right, Bottom Left, Bottom Right
let singleAdLength = 30;
let playAudioOnAd = true;
let twitchUserID = "";
let twitchUserName = "";
let twitchClientId = "";
let twitchOAuthToken = "";
let showMidRollCountdown = "No";	// No, Yes
let aheadOfTimeAlert = 3; // Ahead of time countdown (in minutes)
let pollForNextAdRate = 5; // Polling for next ad rate (in minutes)
let makeTwitchAuthWorkToken = "";

/////////////////////
// CONFIG PARSING //
////////////////////
function SetConfigFromBlob(fieldData) {
	barColor = fieldData.barColor;
	noticeColor = fieldData.noticeColor;
	if (isNumeric(fieldData.lineThickness))
		lineThickness = Number(fieldData.lineThickness);
	
	barPosition = fieldData.barPosition.toLowerCase();
	timerPosition = fieldData.timerPosition.toLowerCase();

	playAudioOnAd = GetBooleanValueFromSettings(fieldData.playAudioOnAd);
	showMidRollCountdown = GetBooleanValueFromSettings(fieldData.showMidRollCountdown);
	aheadOfTimeAlert = fieldData.aheadOfTimeAlert;
	pollForNextAdRate = fieldData.pollForNextAdRate;
	twitchUserName = fieldData.twitchUserName.trim();
	if (isNumeric(fieldData.singleAdLength))
		singleAdLength = Number(fieldData.singleAdLength);
	
	makeTwitchAuthWorkToken = fieldData.makeTwitchAuthWorkToken.trim();
	noticeText = fieldData.noticeText;
}

function PullTwitchAuthToken() {
	let xhr = new XMLHttpRequest();
	xhr.open("POST", "https://make.twitchauth.work/get", false);
	xhr.setRequestHeader("content-type", "text/plain");
	xhr.onload = (e) => {
		if (xhr.readyState === 4) {
		  if (xhr.status === 200) {
			const responseJson = JSON.parse(xhr.responseText);
			if (responseJson.status == "success")
				twitchOAuthToken = responseJson.access_token;
				twitchClientId = responseJson.client_id;
		  } else {
			console.error("OAuth token or channel name is no longer valid! "+xhr.statusText);
		  }
		}
	};
	xhr.onerror = (e) => {
		console.error(xhr.statusText);
		throw "Unable to fetch twitch auth token, you must sign up first";
	};
	xhr.send(makeTwitchAuthWorkToken);
}

// Load up settings from the config system
try {
	console.log("Attempting to read local data config");
	SetConfigFromBlob(configData);
	
} catch (error) {
	if (IsHostedLocally()) {
		console.error("Attempted to run file locally but missing config!!");
		throw "Check config file and settings!";
	} else {
		console.log("A config file does not exist. Might be running from StreamElements?");
	}
}
PullTwitchAuthToken();

// Get the user's channel id if we're using twitch!
function PullTwitchChannelID() {
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
		  console.error("OAuth token or channel name is no longer valid! "+xhr.statusText);
		}
	  }
	};
	xhr.onerror = (e) => {
	  console.error(xhr.statusText);
	};
	xhr.send();
}
PullTwitchChannelID();

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
		  if (TimeUntilNextAlertInMs > 0)
			  SetTimeoutForAdAlert(TimeUntilNextAlertInMs);
		} else {
		  console.error("Failed to get next ad schedule, this may be because of invalid token or twitch error! "+xhr.statusText);
		  EnqueueNextScheduleAdPoll();
		}
	  }
	};
	xhr.onerror = (e) => {
	  console.error("Could not get the next ad schedule! " + xhr.statusText);
	  EnqueueNextScheduleAdPoll();
	};
	xhr.send();
}

function AdMidRoll(data) {
	if (!showMidRollCountdown)
		return;

	ClearMidrollTimerObj();
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
			ShowAdBoxData(false);
			return;
		}
		adsRemainingContainer.innerText = adsRemaining + " of " + adsTotal;
		timerContainer.innerText = startingTime.toString().toHHMMSS();

		// Show the widget
		ShowAdBoxData(true);
	}, 1000)
}

function ShowAdBoxData(isVisible) {
	if (isVisible)
		ShowMidRollCountdown(false);

	let hugeTittiesContainer = document.getElementById("hugeTittiesContainer");
	var tl = new TimelineMax();
	tl.to(hugeTittiesContainer, 0.5, { opacity: isVisible, ease: Linear.easeNone });
}

function ClearMidrollTimerObj() {
	if (midRollTimerObject != null) {
		clearInterval(midRollTimerObject);
		midRollTimerObject = null;
	}
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

function ShowMidRollCountdown(isVisible) {
	ClearMidrollTimerObj();
	
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
	if (usingEventSub)
		RunTwitchEventSub();
	else
		RunTwitchPubSub();
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

if (IsHostedLocally())
	RunOverlay()
else
	console.warn("This overlay widget needs to be hosted locally to work");
