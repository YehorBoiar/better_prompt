let latestInput = "";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "INPUT_UPDATED") {
    latestInput = msg.payload;
  }

  if (msg.type === "GET_INPUT") {
    sendResponse(latestInput);
  }

  return true;
});