const STORAGE_KEY = "pending_tap_url";

const hasSessionStorage = () =>
  typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";

export const rememberPendingTapUrl = (url: string) => {
  if (!hasSessionStorage()) return;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, url);
  } catch (err) {
    console.warn("Unable to cache pending tap URL", err);
  }
};

export const consumePendingTapUrl = () => {
  if (!hasSessionStorage()) return null;

  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY);
    if (value) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return value;
    }
  } catch (err) {
    console.warn("Unable to read pending tap URL", err);
  }

  return null;
};
