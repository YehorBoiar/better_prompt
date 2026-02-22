const FALLBACK_BACKEND_URL = "http://127.0.0.1:3000";

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const resolveBackendBase = () => {
  const raw =
    typeof import.meta.env.VITE_BACKEND_URL === "string"
      ? import.meta.env.VITE_BACKEND_URL.trim()
      : "";

  return stripTrailingSlash(raw || FALLBACK_BACKEND_URL);
};

export const backendBaseUrl = resolveBackendBase();

export const buildBackendUrl = (path: string) =>
  new URL(path, `${backendBaseUrl}/`).toString();
