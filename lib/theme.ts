export const THEME_STORAGE_KEY = "repolens-theme";
export const THEME_CHANGE_EVENT = "repolens-theme";

export type ThemeChoice = "light" | "dark";

/**
 * Runs before paint. Applies a stored choice only. With no choice, the
 * stylesheet follows prefers-color-scheme.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

export function parseStoredTheme(value: string | null | undefined): ThemeChoice | null {
  return value === "light" || value === "dark" ? value : null;
}

export function resolveTheme(stored: ThemeChoice | null, prefersDark: boolean): ThemeChoice {
  if (stored) {
    return stored;
  }
  return prefersDark ? "dark" : "light";
}

export function themeSwitchLabel(theme: ThemeChoice): string {
  return theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
}

export function nextTheme(theme: ThemeChoice): ThemeChoice {
  return theme === "dark" ? "light" : "dark";
}

export function readAppliedTheme(): ThemeChoice {
  const explicit = parseStoredTheme(document.documentElement.dataset.theme ?? null);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return resolveTheme(explicit, prefersDark);
}

export function persistThemeChoice(choice: ThemeChoice): void {
  document.documentElement.dataset.theme = choice;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // The attribute still applies for this view when storage is blocked.
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}
