/**
 * End-to-end tests for the status-UI dark mode (REQ-UI-8).
 *
 * Covers the three behaviours the unit tests cannot reach because they live in
 * the browser: following the OS `prefers-color-scheme` when nothing is stored,
 * toggling the theme, and persisting the choice in `localStorage` across reloads
 * so it overrides the OS preference on the next visit.
 */
import { test, expect, type Page } from "@playwright/test";

const STORAGE_KEY = "pbs-exporter-theme";

/**
 * The app-bar theme toggle. Its accessible name flips with the active theme
 * ("Switch to dark mode" in light, "Switch to light mode" in dark), so match
 * either — the pattern is still unique among the app-bar buttons.
 */
const toggle = (page: Page) =>
  page.getByRole("button", { name: /switch to (dark|light) mode/i });

/** The Vuetify application root, whose class carries the active theme. */
const root = (page: Page) => page.locator(".v-application");

/** The persisted theme preference, or null when none is stored. */
const storedTheme = (page: Page) =>
  page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);

test.describe("status UI dark mode", () => {
  test("follows the OS light preference when nothing is stored", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");

    await expect(toggle(page)).toBeVisible();
    await expect(root(page)).toHaveClass(/v-theme--light/);
    expect(await storedTheme(page)).toBeNull();
  });

  test("follows the OS dark preference when nothing is stored", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");

    await expect(root(page)).toHaveClass(/v-theme--dark/);
    expect(await storedTheme(page)).toBeNull();
  });

  test("toggle switches to dark, persists it, and survives a reload", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await expect(root(page)).toHaveClass(/v-theme--light/);

    await toggle(page).click();
    await expect(root(page)).toHaveClass(/v-theme--dark/);
    expect(await storedTheme(page)).toBe("dark");

    await page.reload();
    await expect(root(page)).toHaveClass(/v-theme--dark/);
    expect(await storedTheme(page)).toBe("dark");
  });

  test("toggling back to light persists and survives a reload", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(root(page)).toHaveClass(/v-theme--dark/);

    await toggle(page).click();
    await expect(root(page)).toHaveClass(/v-theme--light/);
    expect(await storedTheme(page)).toBe("light");

    await page.reload();
    await expect(root(page)).toHaveClass(/v-theme--light/);
    expect(await storedTheme(page)).toBe("light");
  });

  test("a stored preference overrides the OS preference on the next visit", async ({
    page,
  }) => {
    // OS prefers dark; with nothing stored the page loads dark.
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(root(page)).toHaveClass(/v-theme--dark/);

    // Persist a light preference, then reload: the stored value must win.
    await page.evaluate(
      (key) => localStorage.setItem(key, "light"),
      STORAGE_KEY,
    );
    await page.reload();
    await expect(root(page)).toHaveClass(/v-theme--light/);
  });

  test("the toggle glyph, label, and aria-pressed reflect the active theme", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const button = toggle(page);

    // Light mode: offers a switch to dark (moon glyph, not pressed).
    await expect(button).toContainText("☾");
    await expect(button).toHaveAccessibleName("Switch to dark mode");
    await expect(button).toHaveAttribute("aria-pressed", "false");

    await button.click();

    // Dark mode: offers a switch to light (sun glyph, pressed).
    await expect(button).toContainText("☀");
    await expect(button).toHaveAccessibleName("Switch to light mode");
    await expect(button).toHaveAttribute("aria-pressed", "true");
  });
});
