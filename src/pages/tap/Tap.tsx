import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@src/components/ui/button";
import { backendBaseUrl } from "@src/lib/backend";
import { rememberPendingTapUrl } from "@src/lib/tap-session";

const STATUS_COPY: Record<string, string> = {
  card_registered: "Card linked to your account",
  card_verified: "Card verified",
  pending_cleared: "Prompt unblocked",
};

type TapPhase = "parsing" | "auth" | "processing" | "success" | "error";

type CardPayload = {
  sun: string;
  ctr: number;
  mac: string;
};

const LOGIN_PAGE_PATH = "/src/pages/options/index.html";

const redirectToLogin = () => {
  rememberPendingTapUrl(window.location.href);
  const loginUrl = new URL(LOGIN_PAGE_PATH, window.location.origin);
  loginUrl.searchParams.set("redirect", window.location.href);
  window.location.href = loginUrl.toString();
};

export default function Tap() {
  const [phase, setPhase] = useState<TapPhase>("parsing");
  const [message, setMessage] = useState("Reading card payload...");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [cardPayload, setCardPayload] = useState<CardPayload | null>(null);

  const parsedStatusMessage = useMemo(() => {
    if (!result) return message;
    const status = typeof result.status === "string" ? result.status : "";
    return STATUS_COPY[status] ?? message;
  }, [message, result]);

  const isFirstLink = result?.status === "card_registered";
  const statusImage = useMemo(() => {
    if (result?.status === "pending_cleared" && !error) {
      return {
        src: "../../assets/img/good.svg",
        alt: "Blocked prompt cleared",
      };
    }

    if (isFirstLink) {
      return {
        src: "../../assets/img/link.svg",
        alt: "Card linked",
      };
    }

    return {
      src: "../../assets/img/bad.svg",
      alt: error ? "Tap error" : "Tap status",
    };
  }, [error, isFirstLink, result]);

  const triggerTap = useCallback(async (payload: CardPayload) => {
    if (!payload) return;

    const token = localStorage.getItem("session_token");
    if (!token) {
      redirectToLogin();
      return;
    }

    setPhase("processing");
    setMessage("Contacting backend...");
    setError(null);

    const tapUrl = new URL("/tap", `${backendBaseUrl}`);
    tapUrl.searchParams.set("sun", payload.sun);
    tapUrl.searchParams.set("ctr", String(payload.ctr));
    tapUrl.searchParams.set("mac", payload.mac);

    try {
      const response = await fetch(tapUrl.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
      });

      if (response.status === 401) {
        localStorage.removeItem("session_token");
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const detail = body?.detail ?? response.statusText;
        throw new Error(detail || "Failed to verify tap");
      }

      const data = await response.json();
      setResult(data);
      setPhase("success");
      setMessage("Tap processed successfully.");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setPhase("error");
      setMessage("Could not process tap");
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sun = params.get("sun");
    const mac = params.get("mac");
    const ctrRaw = params.get("ctr");

    if (!sun || !mac) {
      setPhase("error");
      setMessage("Missing SUN or MAC in tap URL.");
      setError("Tap link is incomplete. Please rewrite the card.");
      return;
    }

    const ctrValue = Number(ctrRaw ?? "0");
    const payload: CardPayload = {
      sun,
      mac,
      ctr: Number.isFinite(ctrValue) ? ctrValue : 0,
    };

    setCardPayload(payload);
    void triggerTap(payload);
  }, [triggerTap]);

  const handleOpenLogin = () => {
    redirectToLogin();
  };

  const handleRetry = () => {
    if (cardPayload) {
      void triggerTap(cardPayload);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let touchStartY = 0;
    let canPullToRefresh = false;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      touchStartY = event.touches[0].clientY;
      canPullToRefresh = window.scrollY <= 0;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!canPullToRefresh) return;
      const currentY = event.touches[0]?.clientY ?? touchStartY;
      const isPullingDown = currentY - touchStartY > 0;

      if (isPullingDown) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const guardBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "Close this tab and tap again instead of refreshing.";
    };

    window.addEventListener("beforeunload", guardBeforeUnload);
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener("beforeunload", guardBeforeUnload);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-10">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold text-zinc-100">OopsLock</h1>
          <p
            className="text-sm text-zinc-400 mx-10
          "
          >
            a.k.a. How To Not Leak Your Company Secrets Into LLMs 3000
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-2xl shadow-black/40">
          {error ? (
            <p className="mt-2 text-center font-bold text-2xl text-red-500">
              {error}
            </p>
          ) : (
            <p className="mt-2 text-center font-bold text-2xl text-emerald-400">
              {parsedStatusMessage}
            </p>
          )}
          <div className="mt-6 mr-10 flex justify-center">
            <img
              src={statusImage.src}
              alt={statusImage.alt}
              className="h-50 w-50"
            />
          </div>
          {isFirstLink && (
            <div className="mt-6 flex items-center gap-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-100">
              <div className="text-left text-sm leading-relaxed">
                <p className="font-semibold text-amber-50">Card linked</p>
                <p className="text-amber-200/80">
                  Close this tab and tap your card again to approve any blocked
                  prompts. Refreshing this page will not continue the flow.
                </p>
              </div>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            {phase === "auth" && (
              <>
                <Button onClick={handleOpenLogin} className="flex-1">
                  Open Login Page
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleRetry}
                  className="flex-1"
                >
                  Retry Tap
                </Button>
              </>
            )}
          </div>
        </section>

        <footer className="text-center text-xs uppercase tracking-[0.4em] text-zinc-500">
          Huzzah Team • {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}
