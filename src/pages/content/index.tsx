import evaluator, { HeuristicMatch } from "@src/lib/evaluator";

const BLOCK_THRESHOLD = 69;

/**
 * SILENT INTERCEPTOR
 */
const initInterceptor = () => {
  const checkAndBlock = (e: Event, text: string) => {
    const { score, matches } = evaluator(text);

    if (score > BLOCK_THRESHOLD) {
      e.stopImmediatePropagation();
      e.preventDefault();

      renderDetailsModal(score, matches);
      return true;
    }
    return false;
  };

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
 */
const initObserver = () => {
  const findInputAndObserve = () => {
    const input = document.querySelector('[contenteditable="true"]');
    if (!input) return;

    const runEval = () => {
      const { score } = evaluator(input.textContent || ""); // UPDATED: Destructuring
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

/**
 * MODAL TRIGGER & INJECTION
 */
chrome.runtime.onMessage.addListener((request) => {
  if (request.type === "SHOW_DETAILS_OVERLAY") {
    // UPDATED: Actually evaluate the current text instead of hardcoding
    const input = document.querySelector('[contenteditable="true"]');
    const { score, matches } = evaluator(input?.textContent || "");
    renderDetailsModal(score, matches);
  }
});

function renderDetailsModal(score: number, matches: HeuristicMatch[]) {
  // UPDATED: Accepts HeuristicMatch array
  if (document.getElementById("security-modal-root")) return;

  const root = document.createElement("div");
  root.id = "security-modal-root";

  const scoreColor =
    score > 60 ? "#ef4444" : score > 30 ? "#f59e0b" : "#22c55e";
  const statusText =
    score > 60 ? "CRITICAL RISK" : score > 30 ? "WARNING" : "SAFE";

  // UPDATED: Build beautiful cards for each match
  const reasonsHtml =
    matches.length === 0
      ? `<p style="color: #a1a1aa; font-size: 13px; text-align: center; padding: 10px;">No suspicious patterns identified.</p>`
      : matches
          .map(
            (match) => `
        <div style="background: #18181b; border: 1px solid #27272a; padding: 14px; border-radius: 8px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <div style="height: 6px; width: 6px; border-radius: 50%; background: ${scoreColor};"></div>
            <p style="font-size: 14px; font-weight: 700; color: #fafafa; margin: 0;">${
              match.title
            }</p>
          </div>
          <p style="font-size: 12px; color: #a1a1aa; margin: 0 0 10px 14px; line-height: 1.5;">${
            match.description
          }</p>
          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-left: 14px;">
            ${match.keywords
              .map(
                (kw) =>
                  `<span style="background: #27272a; border: 1px solid #3f3f46; color: #d4d4d8; font-size: 10px; font-family: monospace; padding: 2px 6px; border-radius: 4px;">${kw}</span>`
              )
              .join("")}
          </div>
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
            <p style="margin: 4px 0 0 0; font-size: 0.875rem; color: #a1a1aa;">Risk Score: <span style="color: ${scoreColor}; font-weight: bold;">${score}/100</span></p>
          </div>
          <button id="close-modal-x" style="background: none; border: none; color: #71717a; cursor: pointer; font-size: 24px;">✕</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 32px; max-height: 60vh; overflow-y: auto; padding-right: 8px;">
          <div style="background: #09090b; border: 1px solid #27272a; padding: 16px; border-radius: 8px;">
            <p style="font-size: 10px; font-weight: 700; color: #52525b; text-transform: uppercase; margin: 0 0 12px 0;">Triggered Rules</p>
            ${reasonsHtml}
          </div>
        </div>

        <button id="close-modal-btn" style="width: 100%; background: #fafafa; color: #09090b; border: none; border-radius: 8px; padding: 12px; font-weight: 700; cursor: pointer;">
          Acknowledge and Close
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  const close = () => root.remove();
  document.getElementById("close-modal-x")?.addEventListener("click", close);
  document.getElementById("close-modal-btn")?.addEventListener("click", close);
}
