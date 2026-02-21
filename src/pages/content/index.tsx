import evaluator from "@src/lib/evaluator";

const observeInput = () => {
  const findInput = () => {
    const input = document.querySelector('[contenteditable="true"]');
    if (input) {
      input.addEventListener("input", () => {
        const value = input.textContent || "";
        const score = evaluator(value);

        chrome.runtime.sendMessage({
          type: "SCORE_UPDATED",
          payload: score,
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
