import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  THEME_BOOT_SCRIPT,
  THEME_STORAGE_KEY,
  nextTheme,
  parseStoredTheme,
  resolveTheme,
  themeSwitchLabel,
} from "./theme";

test("theme follows the system until the user chooses", () => {
  assert.equal(parseStoredTheme(null), null);
  assert.equal(parseStoredTheme("sepia"), null);
  assert.equal(parseStoredTheme("dark"), "dark");
  assert.equal(resolveTheme(null, true), "dark");
  assert.equal(resolveTheme(null, false), "light");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});

test("theme toggle label names the mode it will switch to", () => {
  assert.equal(themeSwitchLabel("light"), "Switch to dark mode");
  assert.equal(themeSwitchLabel("dark"), "Switch to light mode");
  assert.equal(nextTheme("light"), "dark");
  assert.equal(nextTheme("dark"), "light");
});

test("theme boot script persists only an explicit light or dark choice", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.equal(THEME_STORAGE_KEY, "repolens-theme");
  assert.match(THEME_BOOT_SCRIPT, /repolens-theme/);
  assert.match(THEME_BOOT_SCRIPT, /t==="light"\|\|t==="dark"/);
  assert.equal(THEME_BOOT_SCRIPT.includes("prefers-color-scheme"), false);
  assert.match(layout, /THEME_BOOT_SCRIPT/);
  assert.match(layout, /beforeInteractive/);
  assert.match(layout, /suppressHydrationWarning/);
});
