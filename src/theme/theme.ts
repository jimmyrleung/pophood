import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "pophood.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

// localStorage can throw or be absent (private windows, blocked site data), so every access is guarded.
// When a write fails the override is kept in memory, so the toggle still works until the window closes.
let memoryOverride: Theme | null = null;

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export function readOverride(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isTheme(value) ? value : memoryOverride;
  } catch {
    return memoryOverride;
  }
}

export function writeOverride(theme: Theme | null): void {
  try {
    if (theme === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
    memoryOverride = null;
  } catch {
    memoryOverride = theme;
  }
}

function darkQuery(): MediaQueryList | null {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(DARK_QUERY)
    : null;
}

/** The Windows theme as WebView2 reports it. Dark when it can't be read. */
export function systemTheme(): Theme {
  const query = darkQuery();
  return query === null || query.matches ? "dark" : "light";
}

export function effectiveTheme(): Theme {
  return readOverride() ?? systemTheme();
}

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/**
 * Sets `data-theme` on <html>. Only the attribute carries the theme: Tauri's `setTheme` would also change
 * `prefers-color-scheme` and hide the real Windows theme, which breaks "toggling back clears the override".
 */
export function applyTheme(): Theme {
  const theme = effectiveTheme();
  document.documentElement.dataset.theme = theme;
  notify();
  return theme;
}

/** Switches to the other theme. Switching to the system's own theme clears the override instead of storing it. */
export function toggleTheme(): Theme {
  const next: Theme = effectiveTheme() === "dark" ? "light" : "dark";
  writeOverride(next === systemTheme() ? null : next);
  return applyTheme();
}

/** Follows live Windows theme changes while there is no override. Returns a cleanup function. */
export function watchSystemTheme(): () => void {
  const query = darkQuery();
  if (query === null) return () => {};
  const onChange = () => {
    if (readOverride() === null) applyTheme();
  };
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme);
}
