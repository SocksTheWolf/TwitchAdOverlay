function GetBooleanValueFromSettings(setting) {
	if (typeof(setting) === "string") {
		var LowerString = setting.toLowerCase();
		return LowerString === "yes" || LowerString == "on";
	}
	else
		return setting;
}

function IsInOBS() {
	return (typeof(window.obsstudio) !== 'undefined');
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


function LoadExampleConfigIfNeeded() {
	if (typeof(configData) === "undefined") {
		console.log("Example config is being loaded now");
		var script = document.createElement("script");
		script.src = "config_example.js";
		document.head.appendChild(script);
	}
}

function HasConfigDataKey(key_name) {
	return (typeof(configData) !== "undefined" && 
	typeof(configData[key_name]) !== "undefined" &&
	configData[key_name].length > 0);
}

function ConvertToDataURI(target_json) {
	const OutputText = "var configData = " + JSON.stringify(target_json, null, 3) + ";";
	return "data:text/javascript;base64,"+btoa(OutputText);
}

function CreateConfigDownload(userName, clientID, twitchOAuth) {
	let newConfigData = configData;
	if (userName != null)
		newConfigData["twitchUserName"] = userName;
	
	if (clientID != null)
		newConfigData["twitchClientId"] = clientID;
	
	if (twitchOAuth != null)
		newConfigData["twitchOAuthToken"] = twitchOAuth;
	
	// Generate a new download with the new data
	let a = document.createElement("a");
	a.setAttribute("href", ConvertToDataURI(newConfigData));
    a.setAttribute("download", "config.js");
    a.click();
}

function QueryForTwitchOAuthTokens() {
	const GenerateTwitchOAuth = (clientID) => {
		const scopes = encodeURIComponent("channel:read:ads channel:edit:commercial channel_commercial channel_read");
		const url = 'https://id.twitch.tv/oauth2/authorize?response_type=token&client_id='+ clientID +'&redirect_uri=https://twitchapps.com/tokengen/&scope=' + scopes;
		window.open(url, '_blank').focus();	
	};
	
	if (HasConfigDataKey("twitchClientId")) {
		GenerateTwitchOAuth(configData["twitchClientId"]);
	} else {
		const getClientID = window.prompt("Please enter your twitch client id", "");
		if (getClientID == null || getClientID.length <= 0) {
			console.error("Invalid client id data provided");
		} else {
			GenerateTwitchOAuth(getClientID);
		}
	}
}

function GetDataToSet() {
	var clientID = "";
	var twitchUserName = "";
	var oauthToken = "";
	
	oauthToken = window.prompt("Enter the OAuth token you have generated", "");
	if (oauthToken == null) {
		alert("Provided OAuth Token is not valid, please generate a new one");
		return;
	}
	
	if (!HasConfigDataKey("twitchClientId")) {
		clientID = window.prompt("Enter your twitch client id", "");
	} else {
		clientID = configData["twitchClientId"];
	}
	
	if (!HasConfigDataKey("twitchUserName")) {
		twitchUserName = window.prompt("Enter your twitch user name", "");
	} else {
		twitchUserName = configData["twitchUserName"];
	}
	
	CreateConfigDownload(twitchUserName, clientID, oauthToken);
}

function CreateSetupButtons() {
	let linkContainer = document.getElementById("setupContainer");
	if (!IsInOBS()) {
		// Generate New OAuth
		let GenNewOAuth = document.createElement("a");
		GenNewOAuth.innerText = "Generate new OAuth Token";
		GenNewOAuth.onclick = QueryForTwitchOAuthTokens;
		linkContainer.appendChild(GenNewOAuth);
		
		// Set data
		let SetNewData = document.createElement("a");
		SetNewData.innerText = "Save Data";
		SetNewData.onclick = GetDataToSet;
		linkContainer.appendChild(SetNewData);
		
	} else {
		linkContainer.class = ".hidden";
	}
}

// This will load in the example config file if the main config file cannot be found
LoadExampleConfigIfNeeded();
CreateSetupButtons();