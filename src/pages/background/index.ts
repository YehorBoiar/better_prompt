let latestScore = 0;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SCORE_UPDATED") {
    latestScore = msg.payload;

    if (latestScore > 60) {
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  }
  if (msg.type === "GET_SCORE") {
    sendResponse(latestScore);
  }
  return true;
});
