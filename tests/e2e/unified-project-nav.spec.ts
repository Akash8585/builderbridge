import { expect, test, type Page } from "@playwright/test";
import { openDemoProject, PM_EMAIL, signIn } from "./helpers";

async function expectJoinedNavigation(page: Page) {
  const header = page.locator("header").first();
  const projectNav = page.getByRole("navigation", { name: "Project workspace" });

  await expect(header).toBeVisible();
  await expect(projectNav).toBeVisible();

  const headerBox = await header.boundingBox();
  const projectNavBox = await projectNav.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(projectNavBox).not.toBeNull();
  expect(projectNavBox!.y).toBeGreaterThanOrEqual(headerBox!.y);
  expect(projectNavBox!.y + projectNavBox!.height).toBeLessThanOrEqual(
    headerBox!.y + headerBox!.height + 1
  );
}

test("keeps the global and project navigation joined", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 946 });
  await signIn(page, PM_EMAIL);
  await openDemoProject(page);

  await expect(page.getByRole("link", { name: "Tasks", exact: true })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expectJoinedNavigation(page);

  await page.evaluate(() => window.scrollTo(0, 700));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expectJoinedNavigation(page);

  await page.getByRole("link", { name: "Impacts", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/impacts$/);
  await expect(page.getByRole("link", { name: "Impacts", exact: true })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(page.getByRole("navigation", { name: "Project workspace" })).toHaveCount(1);
});

test("keeps the joined navigation contained on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, PM_EMAIL);
  await openDemoProject(page);

  await expectJoinedNavigation(page);
  await expect(page.getByRole("navigation", { name: "Project workspace" })).toHaveCSS(
    "overflow-x",
    "auto"
  );
  await expect.poll(() =>
    page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
  ).toBe(true);
});
