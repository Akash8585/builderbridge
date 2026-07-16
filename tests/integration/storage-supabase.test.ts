import { describe, expect, it } from "vitest";
import {
  deleteStoredFile,
  isDurableStorageConfigured,
  readStoredFile,
  storageFileUrl,
  uploadFile,
} from "@/lib/storage";

describe.skipIf(!isDurableStorageConfigured())("Supabase private storage", () => {
  it("uploads, range-reads, and deletes an object through the S3 API", async () => {
    const key = `documents/storage-test/roundtrip-${Date.now()}.pdf`;
    try {
      await expect(
        uploadFile(key, Buffer.from("BuilderBridge private storage"), "application/pdf")
      ).resolves.toBe(storageFileUrl(key));

      const complete = await readStoredFile(key);
      expect(Buffer.from(complete.bytes).toString()).toBe("BuilderBridge private storage");
      expect(complete).toMatchObject({
        contentType: "application/pdf",
        contentRange: null,
      });

      const partial = await readStoredFile(key, "bytes=0-12");
      expect(Buffer.from(partial.bytes).toString()).toBe("BuilderBridge");
      expect(partial.contentRange).toMatch(/^bytes 0-12\//);
    } finally {
      await deleteStoredFile(key);
    }
  });
});
