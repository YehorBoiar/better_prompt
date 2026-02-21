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
      alert(
        "NUUUH UUUH SCORE IS (" + score + ")" + " MORE THAN " + BLOCK_THRESHOLD
      );
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

chrome.runtime.onMessage.addListener((request) => {
  if (request.type === "SHOW_DETAILS_OVERLAY") {
    renderDetailsModal(10, ["penis"]);
  }
});

function renderDetailsModal(score: number, reasons: string[]) {
  if (document.getElementById("security-modal-root")) return;

  const root = document.createElement("div");
  root.id = "security-modal-root";

  // 1. DYNAMIC COLOR LOGIC
  const scoreColor =
    score > 60 ? "#ef4444" : score > 30 ? "#f59e0b" : "#22c55e";
  const statusText =
    score > 60 ? "CRITICAL RISK" : score > 30 ? "WARNING" : "SAFE";

  // 2. GENERATE THE LIST ITEMS FROM THE REASONS ARRAY
  const reasonsHtml = reasons
    .map(
      (reason) => `
      <div style="display: flex; gap: 10px; align-items: flex-start;">
        <div style="height: 6px; width: 6px; border-radius: 50%; background: ${scoreColor}; margin-top: 6px;"></div>
        <p style="font-size: 13px; color: #d4d4d8; margin: 0; line-height: 1.5;">${reason}</p>
      </div>
    `
    )
    .join("");

  root.innerHTML = `
    <div style="position: fixed; inset: 0; z-index: 999999; display: flex; align-items: center; justify-content: center; background: rgba(9, 9, 11, 0.85); backdrop-filter: blur(8px); font-family: ui-sans-serif, system-ui, sans-serif;">
      <div style="width: 100%; max-width: 500px; background: #09090b; border: 1px solid #27272a; border-radius: 12px; padding: 32px; color: #fafafa; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div>
            <h2 style="margin: 0; font-size: 1.5rem; font-weight: 700;">Heuristic Analysis</h2>
            <p style="margin: 4px 0 0 0; font-size: 0.875rem; color: #a1a1aa;">Risk Score: ${score}/100</p>
          </div>
          <button id="close-modal-x" style="background: none; border: none; color: #71717a; cursor: pointer; font-size: 24px;">✕</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 32px;">
          <div style="display: flex; gap: 12px;">
            <div style="flex: 1; background: #18181b; border: 1px solid #27272a; padding: 16px; border-radius: 8px;">
              <p style="font-size: 10px; font-weight: 700; color: #52525b; text-transform: uppercase; margin: 0 0 4px 0;">Safety Status</p>
              <p style="font-size: 14px; font-weight: 600; color: ${scoreColor}; margin: 0;">${statusText}</p>
            </div>
          </div>

          <div style="background: #18181b; border: 1px solid #27272a; padding: 20px; border-radius: 8px;">
            <p style="font-size: 10px; font-weight: 700; color: #52525b; text-transform: uppercase; margin: 0 0 12px 0;">Analysis Notes</p>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${reasonsHtml} </div>
          </div>
        </div>

        <button id="close-modal-btn" style="width: 100%; background: #fafafa; color: #09090b; border: none; border-radius: 8px; padding: 12px; font-weight: 700; cursor: pointer;">
          Acknowledge and Close
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  // 3. ATTACH THE EVENT LISTENERS AFTER INJECTION
  const close = () => root.remove();
  document.getElementById("close-modal-x")?.addEventListener("click", close);
  document.getElementById("close-modal-btn")?.addEventListener("click", close);
}
