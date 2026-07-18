"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type AppTheme = "light" | "dark";

const THEME_STORAGE_KEY = "builderbridge:theme";
const THEME_CHANGE_EVENT = "builderbridge:theme-change";

function applyTheme(theme: AppTheme) {
  document.documentElement.dataset.appTheme = theme;
  document.documentElement.style.colorScheme = theme;
}

function readTheme(): AppTheme {
  const htmlTheme = document.documentElement.dataset.appTheme;
  if (htmlTheme === "dark" || htmlTheme === "light") return htmlTheme;

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "dark" || stored === "light" ? stored : "light";
}

function subscribeTheme(callback: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light");

  const nextTheme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(nextTheme);
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
      }}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-hairline-soft bg-canvas text-body transition-colors hover:border-hairline hover:bg-surface-soft hover:text-ink"
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      <Icon size={15} aria-hidden />
    </button>
  );
}
