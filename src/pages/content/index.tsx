const observeInput = () => {
  const findInput = () => {
    const input = document.querySelector('[contenteditable="true"]');
    if (input) {
      console.log("Editable div found:", input);

      input.addEventListener("input", () => {
        const value = input.textContent || "";
        chrome.runtime.sendMessage({
          type: "INPUT_UPDATED",
          payload: value,
        });
      });

      observer.disconnect();
    }
  };

  const observer = new MutationObserver(findInput);
  observer.observe(document.body, { childList: true, subtree: true });

  findInput();
};

observeInput();
try {
  console.log("content script loaded");
} catch (e) {
  console.error(e);
}
