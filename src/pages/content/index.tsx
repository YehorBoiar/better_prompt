import evaluator from "@src/lib/evaluator";

const observeInput = () => {
  const findInput = () => {
    const input = document.querySelector('[contenteditable="true"]');

    if (input) {
      const evaluate = () => {
        const value = input.textContent || "";
        const score = evaluator(value);
        chrome.runtime.sendMessage({
          type: "SCORE_UPDATED",
          payload: score,
        });
      };

      input.addEventListener("input", evaluate);

      const textObserver = new MutationObserver(evaluate);
      textObserver.observe(input, {
        characterData: true,
        childList: true,
        subtree: true,
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
