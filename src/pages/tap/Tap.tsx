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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-10">
        <header className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
            Better Prompt
          </p>
          <h1 className="text-3xl font-semibold text-zinc-100">OopsLock</h1>
          <p
            className="text-sm text-zinc-400 mx-10
          "
          >
            a.k.a. How To Not Leak Your Company Secrets Into LLMs 3000
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-2xl shadow-black/40">
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="text-zinc-400">Status</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                phase === "success"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : phase === "processing"
                    ? "bg-blue-500/20 text-blue-200"
                    : phase === "auth"
                      ? "bg-amber-500/20 text-amber-200"
                      : "bg-zinc-700/60 text-zinc-200"
              }`}
            >
              {phase.toUpperCase()}
            </span>
          </div>
          {error ? (
            <p className="mt-2 text-center font-bold text-2xl text-red-500">
              {error}
            </p>
          ) : (
            <p className="mt-2 text-center font-bold text-2xl text-emerald-400">
              {parsedStatusMessage}
            </p>
          )}
          <div className="mt-6 flex justify-center mr-10">
            {result?.status === "pending_cleared" ? (
              <img
                src="../../assets/img/good.svg"
                alt="Success"
                className="h-50 w-50"
              />
            ) : (
              <img
                src="../../assets/img/bad.svg"
                alt="Error"
                className="h-50 w-50"
              />
            )}
          </div>
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
