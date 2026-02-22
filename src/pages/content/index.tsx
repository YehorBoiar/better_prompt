import evaluator, { HeuristicMatch } from "@src/lib/evaluator";
import { backendBaseUrl } from "@src/lib/backend";

const BLOCK_THRESHOLD = 69;

let isBackendBlocked = true;

if (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
) {
  const localToken = localStorage.getItem("session_token");
  if (localToken) {
    chrome.storage.local.set({ session_token: localToken }, () => {
      console.log("🔗 Extension successfully synced token from Web App!");
    });
  }
}

const startBlockPolling = () => {
  setInterval(() => {
    chrome.storage.local.get(["session_token"], async (result) => {
      const token = result.session_token;
      if (!token) throw new Error("NO TOKEN");
      console.log(token);

      console.log(isBackendBlocked);

      try {
        const response = await fetch(`${backendBaseUrl}/blocked`, {
          method: "GET",
          headers: {
            // Adjust header depending on how your FastAPI require_session expects the token
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
        });

        if (response.ok) {
          const data = await response.json();
          isBackendBlocked = data.is_blocked;
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    });
  }, 2000);
};

startBlockPolling();

/**
 * SILENT INTERCEPTOR
 */
const initInterceptor = () => {
  const checkAndBlock = (e: Event, text: string) => {
    const { score, matches } = evaluator(text);

    if (score > BLOCK_THRESHOLD && isBackendBlocked) {
      e.stopImmediatePropagation();
      e.preventDefault();

      // Show the simple instructions instead of the full breakdown
      renderBlockModal(score);
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

function renderBlockModal(score: number) {
  if (document.getElementById("simple-block-modal-root")) return;

  const root = document.createElement("div");
  root.id = "simple-block-modal-root";

  root.innerHTML = `
    <div style="position: fixed; inset: 0; z-index: 999999; display: flex; align-items: center; justify-content: center; background: rgba(9, 9, 11, 0.85); backdrop-filter: blur(8px); font-family: ui-sans-serif, system-ui, sans-serif;">
      <div style="width: 100%; max-width: 400px; background: #09090b; border: 1px solid #27272a; border-radius: 12px; padding: 24px; color: #fafafa; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); animation: modal-in 0.2s ease-out;">
        
        <style>
          @keyframes modal-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        </style>

        <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 24px;">
          <div style="display: flex; height: 48px; width: 48px; align-items: center; justify-content: center; border-radius: 50%; background: rgba(239, 68, 68, 0.1); color: #ef4444; margin-bottom: 16px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <h2 style="margin: 0 0 8px 0; font-size: 1.25rem; font-weight: 700;">Action Blocked</h2>
          <p style="margin: 0; font-size: 0.875rem; color: #a1a1aa;">Risk Score: <span style="color: #ef4444; font-weight: bold;">${score}</span> / 100</p>
        </div>

        <div style="background: #18181b; border: 1px solid #27272a; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
          <p style="font-size: 13px; color: #d4d4d8; margin: 0 0 12px 0;">This prompt violates security policies. Check the <strong>Details</strong> button in the extension popup for more info.</p>
          
          <p style="font-size: 11px; font-weight: 700; color: #52525b; text-transform: uppercase; margin: 0 0 8px 0;">IF WANT TO SEND NEVERTHELESS</p>
          <ol style="margin: 0; padding-left: 16px; font-size: 13px; color: #a1a1aa; line-height: 1.6;">
            <li>Login via the extension settings.</li>
            <li>Tap your authorized NFC card on your phone.</li>
            <li>Submit the prompt again.</li>
          </ol>
        </div>

        <button id="close-block-btn" style="width: 100%; background: #fafafa; color: #09090b; border: none; border-radius: 8px; padding: 12px; font-weight: 700; cursor: pointer;">
          Got it
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  document
    .getElementById("close-block-btn")
    ?.addEventListener("click", () => root.remove());
}
