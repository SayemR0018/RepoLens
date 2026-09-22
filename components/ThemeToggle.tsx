"use client";

import { useLayoutEffect, useRef } from "react";
import {
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  nextTheme,
  parseStoredTheme,
  persistThemeChoice,
  readAppliedTheme,
  themeSwitchLabel,
} from "@/lib/theme";

export function ThemeToggle() {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button) {
      return;
    }

    const syncLabel = () => {
      button.setAttribute("aria-label", themeSwitchLabel(readAppliedTheme()));
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) {
        return;
      }
      const stored = parseStoredTheme(event.newValue);
      if (stored) {
        document.documentElement.dataset.theme = stored;
      } else {
        delete document.documentElement.dataset.theme;
      }
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    };

    syncLabel();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener(THEME_CHANGE_EVENT, syncLabel);
    window.addEventListener("storage", onStorage);
    media.addEventListener("change", syncLabel);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, syncLabel);
      window.removeEventListener("storage", onStorage);
      media.removeEventListener("change", syncLabel);
    };
  }, []);

  return (
    <button
      ref={buttonRef}
      type="button"
      className="theme-toggle"
      onClick={() => {
        const choice = nextTheme(readAppliedTheme());
        persistThemeChoice(choice);
        buttonRef.current?.setAttribute("aria-label", themeSwitchLabel(choice));
      }}
    >
      <span className="theme-when-light">
        <span aria-hidden="true">Dark</span>
        <span className="sr-only">Switch to dark mode</span>
      </span>
      <span className="theme-when-dark">
        <span aria-hidden="true">Light</span>
        <span className="sr-only">Switch to light mode</span>
      </span>
    </button>
  );
}
