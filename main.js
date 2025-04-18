/////////////////
// GLOBAL VARS //
/////////////////
let midRollTimerObject = null;
let pollForNextAdBreakTimer = null;
let adAlertForNextAdTimer = null;
const twitchAuthLink = "https://make.twitchauth.work/login?template=07ef212b-ecd0-48a0-8392-bc28a2aa20a4";
const twitchHelixUsersEndpoint = "https://api.twitch.tv/helix/users?login=";
const twitchHelixAdEndpoint = "https://api.twitch.tv/helix/channels/ads?broadcaster_id=";
const bypassOBSCheck = true;

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

// there are a lot of console.errors here, this is because OBS by default only logs console.error, this can get changed later.

/////////////////////
//  APP HANDLING  //
////////////////////
const AppRunner = {
  es: null,
  adStartSubId: "",
  loadSettings: function() {
    return new Promise((resolve, reject) => {
      try {
        console.log("Attempting to read local data config");
        // Load up settings from the config system
        {
          barColor = configData.barColor;
          noticeColor = configData.noticeColor;
          if (isNumeric(configData.lineThickness))
            lineThickness = Number(configData.lineThickness);
          
          barPosition = configData.barPosition.toLowerCase();
          timerPosition = configData.timerPosition.toLowerCase();
        
          playAudioOnAd = GetBooleanValueFromSettings(configData.playAudioOnAd);
          showMidRollCountdown = GetBooleanValueFromSettings(configData.showMidRollCountdown);
          aheadOfTimeAlert = configData.aheadOfTimeAlert;
          pollForNextAdRate = configData.pollForNextAdRate;
          twitchUserName = configData.twitchUserName.trim();
          if (isNumeric(configData.singleAdLength))
            singleAdLength = Number(configData.singleAdLength);
          
          makeTwitchAuthWorkToken = configData.makeTwitchAuthWorkToken.trim();
          noticeText = configData.noticeText;
        }
        resolve();
      } catch (error) {
        if (IsHostedLocally()) {
          console.error("Attempted to run file locally but missing config!!");
        } else {
          console.error("A config file does not exist. Might be running from StreamElements?");
        }
        reject("Invalid config data, please check config file and settings!");
      }
    });
  },
  getAuthToken: function() {
    console.log("Fetching new auth token...");
    return new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();
      xhr.open("POST", "https://make.twitchauth.work/get");
      xhr.setRequestHeader("content-type", "text/plain");
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          twitchClientId = data.client_id;
          if (data.status == "success") {
            console.warn(`Setting the oauth token now! Is new: ${twitchOAuthToken != data.access_token}`);
            twitchOAuthToken = data.access_token;
          }
          resolve();
        }
        else
          reject("Failed to get the authentication token!");
      };
      xhr.onerror = () => {
        reject(`Unable to fetch twitch auth token, you must sign up first ${xhr.statusText}`);
      };
      xhr.send(makeTwitchAuthWorkToken);
    });
  },
  getChannelId: function() {
    console.log("Fetching channel id for user");
    return new Promise((resolve, reject) => {
      const helixLookup = twitchHelixUsersEndpoint + twitchUserName;
      let xhr = new XMLHttpRequest();
      xhr.open("GET", helixLookup);
      xhr.setRequestHeader("Authorization", `Bearer ${twitchOAuthToken}`);
      xhr.setRequestHeader("Client-Id", twitchClientId);
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          const responseJson = JSON.parse(xhr.responseText);
          twitchUserID = responseJson.data[0].id;
          resolve();
        } 
        else
          reject("Failed to get channel id for username!");
      };
      xhr.onerror = () => {
        reject(`Unable to get twitch channel id for username ${xhr.statusText}`);
      };
      xhr.send();
    });
  },
  getAdSchedule: function() {
    const helixLookup = twitchHelixAdEndpoint + twitchUserID;
    let xhr = new XMLHttpRequest();
    xhr.open("GET", helixLookup);
    xhr.setRequestHeader("Authorization", `Bearer ${twitchOAuthToken}`);
    xhr.setRequestHeader("Client-Id", twitchClientId);
    
    xhr.onload = () => {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          const responseJson = JSON.parse(xhr.responseText);
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
          console.error(`Failed to get next ad schedule, this may be because of invalid token or twitch error! ${xhr.status}`);
          ClearTimerForObject(pollForNextAdBreakTimer);
          delayCall(AppRunner.restart);
        }
      }
    };
    xhr.onerror = () => {
      console.error(`Could not get the next ad schedule! ${xhr.statusText}`);
      EnqueueNextScheduleAdPoll();
    };
    xhr.send();
  },
  runApp: function() {
    console.error(`Run App`);
    return new Promise((resolve, reject) => {
      SetConnectionStatus(false);
      if (IsHostedLocally() || bypassOBSCheck) {	
        document.getElementById("label").innerHTML = noticeText;
        delayCall(AppRunner.runEventSub);
        resolve();
      } 
      else
        reject("This overlay widget needs to be hosted locally to work");
    });
  },
  start: function() {
    this.loadSettings().then(this.getAuthToken)
      .then(this.getChannelId).then(this.runApp).catch(err => {
        if (err !== undefined && err !== null) {
          console.error(`Error data: ${err}`);
        }
      });
  },
  restart: function() {
    console.warn("Reauthing and restarting...");
    AppRunner.getAuthToken().then(AppRunner.runApp).catch(err => {
      console.error("Failed to restart application!");
      if (err !== undefined && err !== null) {
        console.error(`Restart error data: ${err}`);
      }
    });
  },
  runEventSub: function() {
    // Prevent us running eventsub if the oauth token/channel id is not resolvable.
    if (twitchUserID.length === 0) {
      console.error("The Twitch UserID is at a zero length!");
      return;
    }
    
    // Clean up any old version of the eventSub listener
    if (AppRunner.es !== null) {
      console.error("Twitch EventSub is currently already created, recreating...");
      AppRunner.es.unsubscribe(AppRunner.adStartSubId).then(() => {
        delete AppRunner.es;
        AppRunner.es = null;
        AppRunner.adStartSubId = "";
        delayCall(AppRunner.runEventSub);
        resolve();
      }).catch(err => {
        console.error(`Encountered an error when trying to restart event sub ${err}`);
      });
      return;
    }
  
    console.error("Creating Twitch EventSub system");
    AppRunner.es = new TES({listener: { type: "websocket" }, identity: {
      id: twitchClientId,
      accessToken: twitchOAuthToken,
    }});
    
    AppRunner.es.on("channel.ad_break.begin", event => {
      AdRun({length: event.duration_seconds});
    });

    AppRunner.es.on("connection_lost", (subs) => {
      console.log("Websocket lost connection, resubscribing.")
      Object.values(subs).forEach((sub) => {
        console.log(`Attempting to resubscribe to ${sub.type}`);
        AppRunner.es.subscribe(sub.type, sub.condition).then((data) => {
          AppRunner.adStartSubId = data.id;
          SetConnectionStatus(true);
        });
      });
    });
    
    AppRunner.es.subscribe("channel.ad_break.begin", {
      broadcaster_user_id: twitchUserID,
    }).then((data) => {
      console.error("Adbreak Subscription Successful");
      AppRunner.adStartSubId = data.id;
      SetConnectionStatus(true);
      EnqueueNextScheduleAdPoll(true);
    }).catch(err => {
      console.error(`Failed to subscribe to ad start event ${err}`);
      SetConnectionStatus(false);
      // Attempt to recover.
      delayCall(AppRunner.restart);
    });
    
    AppRunner.es.on("revocation", subscription => {
      console.error(`Subscription was revoked due to ${subscription.status}`);
      SetConnectionStatus(false);
    });
  },
};

///////////////////////
// TWITCH AD OVERLAY //
///////////////////////

function AdRun(data) {
  console.log(`Ads are to be running at length ${data.length}`);
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

function EnqueueNextScheduleAdPoll(shouldGoNow=false) {
  // If we're allowed to show the midroll countdown, start polling.
  if (!showMidRollCountdown)
    return;

  // Clear Ad Poll Timer
  ClearTimerForObject(pollForNextAdBreakTimer);
  if (shouldGoNow)
    pollForNextAdBreakTimer = delayCall(AppRunner.getAdSchedule);
  else
    pollForNextAdBreakTimer = setTimeout(AppRunner.getAdSchedule, 1000 * 60 * pollForNextAdRate);
}

function SetTimeoutForAdAlert(timeInMs) {
  ClearTimerForObject(adAlertForNextAdTimer);
  adAlertForNextAdTimer = setTimeout(AdMidRoll, timeInMs);
}

function AdMidRoll() {
  if (!showMidRollCountdown)
    return;

  ClearMidrollTimerObj();
  MidRollAnimation(aheadOfTimeAlert*60);
  if (playAudioOnAd) {
    const audioPing = document.getElementById("adMidrollStartingNoise");
    audioPing.play();
  }
}

// Ad Overlay progress bar
function TimerBarAnimation(adLength) {
  const timerBar = document.getElementById("timerBar");
  var tl = new TimelineMax();

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
    tl.to(timerBar, 0.5, { width: window.innerWidth + "px", ease: Cubic.ease })
      .to(timerBar, adLength, { width: "0px", ease: Linear.easeNone });
    break;

  case "top":
    timerBar.style.height = lineThickness + "px";
    timerBar.style.top = "0px";
    timerBar.style.left = "0px";

    // Start Animation
    tl.to(timerBar, 0.5, { width: window.innerWidth + "px", ease: Cubic.ease })
      .to(timerBar, adLength, { width: "0px", ease: Linear.easeNone });
    break;

  case "left":
    timerBar.style.width = lineThickness + "px";
    timerBar.style.bottom = "0px";
    timerBar.style.left = "0px";

    // Start Animation
    tl.to(timerBar, 0.5, { height: window.innerHeight + "px", ease: Cubic.ease })
      .to(timerBar, adLength, { height: "0px", ease: Linear.easeNone });
    break;

  case "right":
    timerBar.style.width = lineThickness + "px";
    timerBar.style.bottom = "0px";
    timerBar.style.right = "0px";

    // Start Animation
    tl.to(timerBar, 0.5, { height: window.innerHeight + "px", ease: Cubic.ease })
      .to(timerBar, adLength, { height: "0px", ease: Linear.easeNone });
    break;
  }
}

// Ad In Progress Info + Animation
function HugeTittiesAnimation(adLength) {
  const hugeTittiesContainer = document.getElementById("hugeTittiesContainer");
  const timerPosLower = timerPosition.toLowerCase();
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
  const labelColor = document.getElementById("label");
  labelColor.style.background = barColor;
  labelColor.style.color = noticeColor;

  // Calculate starting time
  let startingTime = adLength % singleAdLength;
  if (startingTime == 0)
    startingTime = singleAdLength;

  // Estimate how many ads there should be
  const adsTotal = Math.ceil(adLength / singleAdLength);
  let adsRemaining = 1;

  // Start the countdown timer
  const adsRemainingContainer = document.getElementById("adsRemainingContainer");
  const timerContainer = document.getElementById("timerContainer");
  
  if (playAudioOnAd) {
    const audioPing = document.getElementById("adAudioNoise");
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
    adsRemainingContainer.innerText = `${adsRemaining} of ${adsTotal}`;
    timerContainer.innerText = startingTime.toString().toHHMMSS();

    // Show the widget
    ShowAdBoxData(true);
  }, 1000)
}

function ShowAdBoxData(isVisible) {
  if (isVisible)
    ShowMidRollCountdown(false);

  const hugeTittiesContainer = document.getElementById("hugeTittiesContainer");
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
  const midRollContainer = document.getElementById("midRollContainer");
  const midRollCountdownContainer = document.getElementById("midRollCountdownContainer");
  const width = midRollContainer.getBoundingClientRect().width;
  
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
  }, 1000);
}

function ShowMidRollCountdown(isVisible) {
  ClearMidrollTimerObj();
  
  const midRollContainer = document.getElementById("midRollContainer");
  const width = midRollContainer.getBoundingClientRect().width;
  var tl = new TimelineMax();

  if (isVisible) {
    tl.to(midRollContainer, 0.5, { right: "-10px", ease: Power1.easeInOut });
  } else {
    tl.to(midRollContainer, 0.5, { right: -width + "px", ease: Power1.easeInOut });
  }
}

//////////////////////
// HELPER FUNCTIONS //
//////////////////////

String.prototype.toHHMMSS = function () {
  const sec_num = parseInt(this, 10); // don't forget the second param
  var hours = Math.floor(sec_num / 3600);
  var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
  var seconds = sec_num - (hours * 3600) - (minutes * 60);

  if (hours < 10) { hours = "0" + hours; }
  //if (minutes < 10) {minutes = "0"+minutes;}
  if (seconds < 10) { seconds = "0" + seconds; }
  //return hours+':'+minutes+':'+seconds;
  return minutes + ':' + seconds;
}

function SetConnectionStatus(connected) {
  const statusContainer = document.getElementById("statusContainer");
  if (connected) {
    statusContainer.style.background = "#2FB774";
    statusContainer.innerText = "Connected!";
    var tl = new TimelineMax();
    tl.to(statusContainer, 2, { opacity: 0, ease: Linear.easeNone });
    //.call(removeElement, [div]);
  } else {
    statusContainer.style.background = "#D12025";
    statusContainer.innerText = "Connecting...";
    statusContainer.style.opacity = 1;
  }
}

// This is a silly function to handle reload execution without having to worry about
// the OBS stackframe reentry.
function delayCall(func) {
  return setTimeout(func, 5);
}

AppRunner.start();
