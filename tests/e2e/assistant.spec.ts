import { test, expect } from "@playwright/test";
import { PM_EMAIL, signIn } from "./helpers";

test("project conversations stream and persist across reloads", async ({ page }) => {
  const prompt = `E2E assistant persistence ${Date.now()}`;
  await signIn(page, PM_EMAIL);

  try {
    await page.getByRole("button", { name: "Open BuilderBridge AI" }).click();
    const dialog = page.getByRole("dialog", { name: "BuilderBridge AI" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Powered by OpenRouter")).toBeVisible();

    await dialog.getByRole("button", { name: "Start new conversation" }).click();
    await dialog.getByLabel("Message BuilderBridge AI").fill(prompt);
    await dialog.getByRole("button", { name: "Send message" }).click();
    await expect(dialog.locator('[data-message-role="user"]').getByText(prompt, { exact: true })).toBeVisible();
    await expect(dialog.locator('[data-message-role="assistant"]')).toBeVisible({ timeout: 60_000 });
    await expect(dialog.getByRole("button", { name: "Send message" })).toBeVisible({ timeout: 60_000 });

    await page.reload();
    await page.getByRole("button", { name: "Open BuilderBridge AI" }).click();
    const reloadedDialog = page.getByRole("dialog", { name: "BuilderBridge AI" });
    await expect(reloadedDialog.getByRole("button", { name: prompt })).toBeVisible();
  } finally {
    const response = await page.request.get("/api/assistant/conversations");
    if (response.ok()) {
      const data = await response.json();
      const matches = data.conversations.filter(
        (conversation: { id: string; title: string }) =>
          conversation.title === prompt || conversation.title.startsWith("E2E assistant persistence")
      );
      await Promise.all(
        matches.map((conversation: { id: string }) =>
          page.request.delete(`/api/assistant/conversations/${conversation.id}`)
        )
      );
    }
  }
});
