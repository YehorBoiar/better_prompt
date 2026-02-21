let latestScore = 0;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SCORE_UPDATED") {
    latestScore = msg.payload;
  }
  if (msg.type === "GET_SCORE") {
    sendResponse(latestScore);
  }
  return true;
});
