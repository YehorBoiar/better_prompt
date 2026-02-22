import { useCallback, useEffect, useState } from "react";
import { Button } from "@src/components/ui/button";
import { Input } from "@src/components/ui/input";
import { Label } from "@src/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@src/components/ui/card";
import { buildBackendUrl } from "@src/lib/backend";
import { consumePendingTapUrl } from "@src/lib/tap-session";

const ensureSameOrigin = (value: string | null) => {
  if (!value || typeof window === "undefined") return null;
  try {
    const candidate = new URL(value, window.location.origin);
    return candidate.origin === window.location.origin
      ? candidate.toString()
      : null;
  } catch {
    return null;
  }
};

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [redirectParam] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const params = new URLSearchParams(window.location.search);
      return ensureSameOrigin(params.get("redirect"));
    } catch {
      return null;
    }
  });

  const redirectToPendingTap = useCallback(() => {
    const pendingUrl = ensureSameOrigin(consumePendingTapUrl());
    if (pendingUrl) {
      window.location.href = pendingUrl;
      return;
    }

    if (redirectParam) {
      window.location.href = redirectParam;
    }
  }, [redirectParam]);

  useEffect(() => {
    const token = localStorage.getItem("session_token");
    if (token) {
      redirectToPendingTap();
    }
  }, [redirectToPendingTap]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setIsLoading(true);
    try {
      const response = await fetch(buildBackendUrl("/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Login failed");
      }

      const data = await response.json();
      console.log("Success:", data);

      // 1. Store token for Web (iPhone)
      localStorage.setItem("session_token", data.session_token);

      window.postMessage(
        { type: "SYNC_TOKEN", token: data.session_token },
        "*"
      );

      alert(data.is_new_user ? "Account created!" : "Logged in!");

      redirectToPendingTap();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-4 text-zinc-50">
      <Card className="w-full max-w-sm border-0 sm:border sm:border-zinc-800 bg-zinc-950 sm:bg-zinc-900 shadow-none sm:shadow-2xl">
        <CardHeader className="pt-8 sm:pt-6">
          <CardTitle className="text-center text-xl font-bold tracking-widest text-zinc-100">
            LOGIN PAGE
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-zinc-400">
                input username:
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="aboba"
                className="border-zinc-800 sm:border-zinc-700 bg-zinc-900 sm:bg-zinc-950 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-zinc-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-400">
                input password:
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="super secret"
                className="border-zinc-800 sm:border-zinc-700 bg-zinc-900 sm:bg-zinc-950 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-zinc-500"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-zinc-100 text-zinc-950 hover:bg-zinc-200 sm:bg-zinc-100 sm:text-zinc-950 sm:hover:bg-zinc-950 sm:hover:text-zinc-100"
            >
              {isLoading ? "Processing..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
