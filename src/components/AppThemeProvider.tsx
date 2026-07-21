"use client";

import { useLayoutEffect, type ReactNode } from "react";

type AppTheme = "light" | "dark";

const THEME_STORAGE_KEY = "builderbridge:theme";
const THEME_CHANGE_EVENT = "builderbridge:theme-change";

function readStoredTheme(): AppTheme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : "light";
  } catch {
    return "light";
  }
}

function applyShellTheme(shell: HTMLElement, theme: AppTheme) {
  shell.dataset.appTheme = theme;
  shell.style.colorScheme = theme;
}

/**
 * Applies light/dark tokens only inside `.app-shell`. Marketing pages sit
 * outside this tree and always keep the default light :root palette.
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const shell = document.querySelector<HTMLElement>(".app-shell");
    if (!shell) return;

    const sync = () => applyShellTheme(shell, readStoredTheme());
    sync();

    window.addEventListener(THEME_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return children;
}
