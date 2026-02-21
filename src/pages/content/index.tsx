import evaluator from "@src/lib/evaluator";

const BLOCK_THRESHOLD = 69;

/**
 * SILENT INTERCEPTOR
 * Captures the event before ChatGPT can process it.
 */
const initInterceptor = () => {
  const checkAndBlock = (e: Event, text: string) => {
    const score = evaluator(text);
    if (score > BLOCK_THRESHOLD) {
      e.stopImmediatePropagation();
      e.preventDefault();
      alert("NUUUH UUUH SCORE IS (" + score + ")" + " MORE THAN " + BLOCK_THRESHOLD);
      return true;
    }
    return false;
  };

  // 1. Intercept Enter Key
  window.addEventListener(
    "keydown",
    (e) => {
      const target = e.target as HTMLElement;
      if (
        target.matches('[contenteditable="true"]') &&
        e.key === "Enter" &&
        !e.shiftKey
      ) {
        checkAndBlock(e, target.textContent || "");
      }
    },
    true
  );

  // 2. Intercept Click on Send Button
  window.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement;
      const sendButton = target.closest(
        'button[data-testid="send-button"], button[aria-label="Send prompt"]'
      );

      if (sendButton) {
        const input = document.querySelector('[contenteditable="true"]');
        checkAndBlock(e, input?.textContent || "");
      }
    },
    true
  );
};

/**
 * REAL-TIME OBSERVER
 * Keeps the popup/background score in sync.
 */
const initObserver = () => {
  const findInputAndObserve = () => {
    const input = document.querySelector('[contenteditable="true"]');
    if (!input) return;

    const runEval = () => {
      const score = evaluator(input.textContent || "");
      chrome.runtime.sendMessage({ type: "SCORE_UPDATED", payload: score });
    };

    input.addEventListener("input", runEval);
    new MutationObserver(runEval).observe(input, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  };

  new MutationObserver(findInputAndObserve).observe(document.body, {
    childList: true,
    subtree: true,
  });
  findInputAndObserve();
};

// Start
initInterceptor();
initObserver();
