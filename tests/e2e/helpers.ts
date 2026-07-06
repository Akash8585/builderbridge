import { type Page, expect } from "@playwright/test";

export const DEMO_PASSWORD = "password123";
export const PM_EMAIL = "jane@buildflow.dev";
export const TRADE_EMAIL = "tom@buildflow.dev";

/** Signs in via the real form and waits until the projects list is visible. */
export async function signIn(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/projects/, { timeout: 20_000 });
}

/** Opens the seeded demo project's Tasks tab. */
export async function openDemoProject(page: Page) {
  await page.goto("/projects");
  await page.getByRole("link", { name: /Riverside Apartments/ }).first().click();
  await expect(page.getByRole("heading", { name: /Riverside Apartments/ })).toBeVisible();
}
