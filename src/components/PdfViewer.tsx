"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import {
  PDF_VIEWER_EVENT,
  pdfPageUrl,
  type PdfViewerDocument,
  type PdfViewerRequest,
} from "@/lib/pdf-viewer";

export function PdfViewerPanel({
  document,
  onClose,
  variant = "dashboard",
}: {
  document: PdfViewerDocument;
  onClose: () => void;
  variant?: "dashboard" | "agent";
}) {
  const [page, setPage] = useState(document.page);

  const pageCount = document.pageCount ?? null;
  const currentDocument = { ...document, page };
  const setValidPage = (nextPage: number) => {
    setPage(Math.max(1, pageCount ? Math.min(pageCount, nextPage) : nextPage));
  };

  return (
    <section
      aria-label={`PDF viewer: ${document.title}`}
      className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden ${
        variant === "agent"
          ? "border-l border-[var(--assistant-border)] bg-[var(--assistant-panel)] text-[var(--assistant-text)]"
          : "bg-canvas text-ink shadow-[-24px_0_60px_rgba(17,17,17,0.18)]"
      }`}
    >
      <header
        className={`flex h-14 shrink-0 items-center gap-2 px-3 sm:px-4 ${
          variant === "agent"
            ? "border-b border-[var(--assistant-border)] bg-[var(--assistant-layer)]"
            : "border-b border-hairline bg-canvas"
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{document.title}</p>
          <p className={`text-[11px] ${variant === "agent" ? "text-[var(--assistant-text-muted)]" : "text-muted"}`}>
            Page {page}{pageCount ? ` of ${pageCount}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setValidPage(page - 1)}
            disabled={page <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-md text-current opacity-65 transition-opacity hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-25"
            aria-label="Previous PDF page"
            title="Previous page"
          >
            <ChevronLeft size={17} aria-hidden />
          </button>
          <label className="sr-only" htmlFor={`pdf-page-${variant}`}>PDF page</label>
          <input
            id={`pdf-page-${variant}`}
            type="number"
            min={1}
            max={pageCount ?? undefined}
            value={page}
            onChange={(event) => setValidPage(Number(event.target.value) || 1)}
            className={`h-8 w-12 rounded-md border bg-transparent px-1 text-center text-xs tabular-nums outline-none ${
              variant === "agent"
                ? "border-[var(--assistant-border)] text-[var(--assistant-text-body)] focus:border-[var(--assistant-border-strong)]"
                : "border-hairline text-body focus:border-muted-soft"
            }`}
          />
          <button
            type="button"
            onClick={() => setValidPage(page + 1)}
            disabled={pageCount !== null && page >= pageCount}
            className="flex h-8 w-8 items-center justify-center rounded-md text-current opacity-65 transition-opacity hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-25"
            aria-label="Next PDF page"
            title="Next page"
          >
            <ChevronRight size={17} aria-hidden />
          </button>
          <a
            href={pdfPageUrl(currentDocument)}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-md text-current opacity-65 transition-opacity hover:opacity-100"
            aria-label="Open PDF in a new tab"
            title="Open in new tab"
          >
            <ExternalLink size={15} aria-hidden />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-current opacity-65 transition-opacity hover:opacity-100"
            aria-label="Close PDF viewer"
            title="Close viewer"
          >
            <X size={17} aria-hidden />
          </button>
        </div>
      </header>
      <iframe
        key={`${document.url}:${page}`}
        src={pdfPageUrl(currentDocument)}
        title={`${document.title}, page ${page}`}
        className="min-h-0 w-full flex-1 border-0 bg-[#525659]"
      />
    </section>
  );
}

export function DashboardPdfViewer() {
  const [document, setDocument] = useState<PdfViewerDocument | null>(null);

  useEffect(() => {
    const openViewer = (event: Event) => {
      const request = (event as CustomEvent<PdfViewerRequest>).detail;
      if (request?.placement !== "dashboard") return;
      setDocument(request);
    };
    window.addEventListener(PDF_VIEWER_EVENT, openViewer);
    return () => window.removeEventListener(PDF_VIEWER_EVENT, openViewer);
  }, []);

  useEffect(() => {
    if (!document) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDocument(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [document]);

  if (!document) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/18" role="dialog" aria-modal="true" aria-label="Project PDF viewer">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={() => setDocument(null)}
        aria-label="Close PDF viewer"
      />
      <div className="absolute inset-y-0 right-0 w-full sm:w-1/2 sm:min-w-[560px] sm:max-w-[960px]">
        <PdfViewerPanel
          key={`${document.url}:${document.page}`}
          document={document}
          onClose={() => setDocument(null)}
        />
      </div>
    </div>
  );
}
