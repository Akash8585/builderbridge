import { describe, expect, it } from "vitest";
import { pdfPageUrl, pdfViewerDocument } from "@/lib/pdf-viewer";

describe("PDF viewer navigation", () => {
  it("reads an exact page from a citation URL", () => {
    expect(pdfViewerDocument("/api/files/project/report.pdf#page=7", "Report")).toEqual({
      url: "/api/files/project/report.pdf",
      title: "Report",
      page: 7,
      pageCount: undefined,
    });
  });

  it("uses an explicit page and creates a browser PDF target", () => {
    const document = pdfViewerDocument("/api/files/project/report.pdf#page=2", "Report", {
      page: 4,
      pageCount: 12,
    });
    expect(pdfPageUrl(document)).toBe(
      "/api/files/project/report.pdf#page=4&zoom=page-width"
    );
  });

  it("falls back to the first page for invalid citation fragments", () => {
    expect(pdfViewerDocument("/api/files/project/report.pdf#page=nope", "Report").page).toBe(1);
  });
});
