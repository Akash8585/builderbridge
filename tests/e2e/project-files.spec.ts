import { test, expect } from "@playwright/test";
import { openDemoProject, PM_EMAIL, signIn } from "./helpers";

function searchablePdf(text: string): Buffer {
  const escaped = text.replace(/([()\\])/g, "\\$1");
  const content = `BT\n/F1 12 Tf\n72 720 Td\n(${escaped}) Tj\nET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  }
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body);
}

test("project files upload, index, open, filter, and delete securely", async ({ page }) => {
  const marker = Date.now();
  const fileName = `door-spec-${marker}.pdf`;
  const pdfBuffer = searchablePdf("Fire rated corridor doors require a 90 minute rating and smoke seals.");
  let uploadedId: string | null = null;
  await signIn(page, PM_EMAIL);
  await openDemoProject(page);
  await expect(page).toHaveURL(/\/projects\/[^/?#]+$/);
  const pathSegments = new URL(page.url()).pathname.split("/").filter(Boolean);
  const projectId = pathSegments[pathSegments.indexOf("projects") + 1];
  await page.goto(`/projects/${projectId}/files`);

  try {
    const uploadResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/projects/${projectId}/files`) &&
        response.request().method() === "POST"
    );
    await page.getByLabel("Choose project files").setInputFiles({
      name: fileName,
      mimeType: "application/pdf",
      buffer: pdfBuffer,
    });
    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.status()).toBe(201);
    const uploaded = await uploadResponse.json();
    uploadedId = uploaded.id;
    expect(uploaded.extractionStatus).toBe("READY");

    const duplicateResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/projects/${projectId}/files`) &&
        response.request().method() === "POST"
    );
    await page.getByLabel("Choose project files").setInputFiles({
      name: `duplicate-${fileName}`,
      mimeType: "application/pdf",
      buffer: pdfBuffer,
    });
    expect((await duplicateResponsePromise).status()).toBe(409);
    await expect(page.getByRole("alert")).toContainText("exact file is already stored");

    const disguisedResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/projects/${projectId}/files`) &&
        response.request().method() === "POST"
    );
    await page.getByLabel("Choose project files").setInputFiles({
      name: `disguised-${marker}.pdf`,
      mimeType: "application/pdf",
      buffer: Buffer.from("This is not a PDF."),
    });
    expect((await disguisedResponsePromise).status()).toBe(415);
    await expect(page.getByRole("alert")).toContainText("contents must be PDF");

    const row = page.locator("tbody tr").filter({ hasText: fileName });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Project file");
    await expect(row).toContainText("Search ready");
    await expect(row).toContainText("Files workspace");
    const fileButton = row.getByRole("button", { name: fileName, exact: true });
    await fileButton.click();
    const pdfDialog = page.getByRole("dialog", { name: "Project PDF viewer" });
    await expect(pdfDialog).toBeVisible();
    const pdfFrame = pdfDialog.locator("iframe");
    await expect(pdfFrame).toHaveAttribute("title", `${fileName}, page 1`);
    const href = (await pdfFrame.getAttribute("src"))?.split("#", 1)[0];
    expect(href).toMatch(/^\/api\/files\/documents\//);
    const rangeResponse = await page.request.get(href!, { headers: { Range: "bytes=0-7" } });
    expect(rangeResponse.status()).toBe(206);
    expect((await rangeResponse.body()).toString()).toBe("%PDF-1.4");
    expect(rangeResponse.headers()["x-frame-options"]).toBe("SAMEORIGIN");
    expect(rangeResponse.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");
    await pdfDialog.getByRole("button", { name: "Close PDF viewer" }).click();
    await expect(pdfDialog).toBeHidden();

    const downloadPromise = page.waitForEvent("download");
    await row.getByRole("link", { name: `Download ${fileName}` }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(fileName);

    await page.goto(`/projects/${projectId}/activity`);
    const recentActivity = page.getByRole("region", { name: "Recent activity" });
    await expect(recentActivity).toContainText(`downloaded ${fileName}`);
    await expect(recentActivity).toContainText(`viewed ${fileName}`);
    await page.goto(`/projects/${projectId}/files`);

    const refreshedRow = page.locator("tbody tr").filter({ hasText: fileName });
    await refreshedRow.getByRole("button", { name: `Ask Agent about ${fileName}` }).click();
    const assistantDialog = page.getByRole("dialog", { name: "Agent" });
    await expect(assistantDialog).toBeVisible();
    await expect(assistantDialog.getByLabel("Message Agent")).toHaveValue(
      `What does "${fileName}" say?`
    );
    await assistantDialog.getByRole("button", { name: "Close Agent" }).click();

    await page.getByRole("button", { name: "Direct uploads" }).click();
    await expect(refreshedRow).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("button", { name: "Upload", exact: true })).toBeVisible();
    const mobileFile = page.getByRole("listitem").filter({ hasText: fileName });
    await expect(mobileFile).toContainText("Search ready");

    page.once("dialog", (dialog) => dialog.accept());
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/projects/${projectId}/files/${uploaded.id}`) &&
        response.request().method() === "DELETE"
    );
    await mobileFile.getByRole("button", { name: `Delete ${fileName}` }).click();
    expect((await deleteResponsePromise).status()).toBe(204);
    uploadedId = null;
    await expect(refreshedRow).toHaveCount(0);
  } finally {
    if (uploadedId) {
      await page.request.delete(`/api/projects/${projectId}/files/${uploadedId}`);
    }
  }
});
