export type PdfViewerPlacement = "dashboard" | "agent";

export type PdfViewerDocument = {
  url: string;
  title: string;
  page: number;
  pageCount?: number | null;
};

export type PdfViewerRequest = PdfViewerDocument & {
  placement: PdfViewerPlacement;
};

export const PDF_VIEWER_EVENT = "builderbridge:open-pdf-viewer";

function positivePage(value: string | null | undefined): number | null {
  if (!value) return null;
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : null;
}

export function pdfViewerDocument(
  url: string,
  title: string,
  options?: { page?: number; pageCount?: number | null }
): PdfViewerDocument {
  const [baseUrl, hash = ""] = url.split("#", 2);
  const hashPage = positivePage(new URLSearchParams(hash).get("page"));
  return {
    url: baseUrl,
    title,
    page: options?.page ?? hashPage ?? 1,
    pageCount: options?.pageCount,
  };
}

export function pdfPageUrl(document: PdfViewerDocument): string {
  const page = Math.max(1, Math.floor(document.page));
  return `${document.url}#page=${page}&zoom=page-width`;
}

export function fileDownloadUrl(url: string): string {
  const [baseUrl] = url.split("#", 1);
  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}download=1`;
}

export function openPdfViewer(
  url: string,
  title: string,
  placement: PdfViewerPlacement,
  options?: { page?: number; pageCount?: number | null }
) {
  window.dispatchEvent(
    new CustomEvent<PdfViewerRequest>(PDF_VIEWER_EVENT, {
      detail: { ...pdfViewerDocument(url, title, options), placement },
    })
  );
}
