/**
 * End-to-end layout checks for the status page (REQ-UI-7).
 *
 * Vuetify's `.v-footer` is `flex: 1 1 auto`, so inside the column-flex app wrap
 * it happily grows to absorb the leftover viewport height — the footer text
 * then floats in the middle of a block hundreds of pixels tall. Only a real
 * browser can catch that, hence an e2e test rather than a unit test.
 */
import { test, expect } from "@playwright/test";

test.describe("status UI layout", () => {
  test("keeps the footer a compact strip pinned below the content", async ({
    page,
  }) => {
    await page.goto("/");

    const footer = page.locator(".v-footer");
    await expect(footer).toBeVisible();

    const box = await footer.boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) {
      throw new Error("footer or viewport has no box");
    }

    // One line of caption text plus py-3 padding — nowhere near the ~250px it
    // used to occupy when it stretched.
    expect(box.height).toBeLessThan(80);
    // The page is short here (no targets), so the footer ends at the bottom of
    // the viewport rather than floating above empty space.
    expect(box.y + box.height).toBeGreaterThanOrEqual(viewport.height - 1);
  });

  test("gives the leftover height to the main content, not the footer", async ({
    page,
  }) => {
    await page.goto("/");

    const main = page.locator(".v-main");
    const footer = page.locator(".v-footer");
    const mainBox = await main.boundingBox();
    const footerBox = await footer.boundingBox();
    if (!mainBox || !footerBox) {
      throw new Error("main or footer has no box");
    }

    expect(mainBox.height).toBeGreaterThan(footerBox.height);
    // The footer starts where the main area ends: no gap, no overlap.
    expect(footerBox.y).toBeCloseTo(mainBox.y + mainBox.height, 0);
  });
});
