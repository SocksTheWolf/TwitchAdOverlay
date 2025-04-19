function GetBooleanValueFromSettings(setting) {
  if (typeof(setting) === "string") {
    var LowerString = setting.toLowerCase();
    return LowerString === "yes" || LowerString == "on" || LowerString == "true";
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
    console.warn("Example config is being loaded now");
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

function CreateConfigDownload(userName, twitchOAuth) {
  let newConfigData = configData;
  if (userName != null)
    newConfigData["twitchUserName"] = userName;
  
  if (twitchOAuth != null)
    newConfigData["makeTwitchAuthWorkToken"] = twitchOAuth;
  
  // Generate a new download with the new data
  let a = document.createElement("a");
  a.setAttribute("href", ConvertToDataURI(newConfigData));
  a.setAttribute("download", "config.js");
  a.click();
}

function QueryForTwitchOAuthTokens() {
  window.open(twitchAuthLink, '_blank').focus();	
}

function GetDataToSet() {
  var twitchUserName = "";
  var oauthToken = "";
  
  oauthToken = window.prompt("Enter the User Auth Token", "");
  if (oauthToken == null) {
    alert("Provided User Auth Token is not valid, please generate a new one");
    return;
  }
  
  if (!HasConfigDataKey("twitchUserName")) {
    twitchUserName = window.prompt("Enter your twitch user name", "");
  } else {
    twitchUserName = configData["twitchUserName"];
  }
  
  CreateConfigDownload(twitchUserName, oauthToken);
}

function CreateSetupButtons() {
  let linkContainer = document.getElementById("setupContainer");
  if (!IsInOBS()) {
    // Generate New OAuth
    let GenNewOAuth = document.createElement("a");
    GenNewOAuth.innerText = "Get User Login Token";
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