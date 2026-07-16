import type { AssistantAttachment, DocumentProcessingStatus } from "@prisma/client";
import { extractText } from "unpdf";
import { prisma } from "@/lib/prisma";
import { readStoredFile } from "@/lib/storage";

export const MAX_EXTRACTED_TEXT_CHARS = 250_000;
export const MAX_DOCUMENT_CHUNK_CHARS = 1_500;

export type ExtractedDocumentChunk = {
  pageNumber: number;
  chunkIndex: number;
  text: string;
};

export type DocumentExtractionResult = {
  status: DocumentProcessingStatus;
  text: string | null;
  pageCount: number | null;
  error: string | null;
  chunks: ExtractedDocumentChunk[];
};

function normalizeExtractedText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkPageText(text: string, pageNumber: number): ExtractedDocumentChunk[] {
  const chunks: ExtractedDocumentChunk[] = [];
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  let current = "";
  const push = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    chunks.push({ pageNumber, chunkIndex: chunks.length, text: normalized });
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > MAX_DOCUMENT_CHUNK_CHARS) {
      push(current);
      current = "";
      for (let start = 0; start < paragraph.length; start += MAX_DOCUMENT_CHUNK_CHARS - 180) {
        push(paragraph.slice(start, start + MAX_DOCUMENT_CHUNK_CHARS));
      }
    } else if (!current) {
      current = paragraph;
    } else if (current.length + paragraph.length + 2 <= MAX_DOCUMENT_CHUNK_CHARS) {
      current += `\n\n${paragraph}`;
    } else {
      push(current);
      current = paragraph;
    }
  }
  push(current);
  return chunks;
}

export async function extractDocumentText(
  bytes: Uint8Array,
  mediaType: string
): Promise<DocumentExtractionResult> {
  if (mediaType !== "application/pdf") {
    return {
      status: "UNSUPPORTED",
      text: null,
      pageCount: null,
      error: "Text extraction currently supports searchable PDF files. Image OCR is not enabled yet.",
      chunks: [],
    };
  }

  try {
    const pdfBytes = new Uint8Array(bytes.byteLength);
    pdfBytes.set(bytes);
    const result = await extractText(pdfBytes);
    const rawPages = Array.isArray(result.text) ? result.text : [result.text];
    let remainingCharacters = MAX_EXTRACTED_TEXT_CHARS;
    const pages = rawPages.map((page, index) => {
      const normalized = normalizeExtractedText(page);
      const text = normalized.slice(0, Math.max(remainingCharacters, 0));
      remainingCharacters -= text.length;
      return { pageNumber: index + 1, text };
    });
    const text = pages.map((page) => page.text).filter(Boolean).join("\n\n");
    const chunks = pages.flatMap((page) => chunkPageText(page.text, page.pageNumber));
    if (!text) {
      return {
        status: "UNSUPPORTED",
        text: null,
        pageCount: result.totalPages,
        error: "No searchable text was found. This PDF may need OCR.",
        chunks: [],
      };
    }
    return {
      status: "READY",
      text,
      pageCount: result.totalPages,
      error: null,
      chunks,
    };
  } catch (error) {
    console.error("Project PDF text extraction failed", error);
    return {
      status: "FAILED",
      text: null,
      pageCount: null,
      error: "BuilderBridge could not extract text from this PDF.",
      chunks: [],
    };
  }
}

export async function processProjectDocument(
  document: Pick<AssistantAttachment, "id" | "storageKey" | "mediaType">,
  providedBytes?: Uint8Array
): Promise<AssistantAttachment> {
  await prisma.assistantAttachment.update({
    where: { id: document.id },
    data: {
      extractionStatus: "PROCESSING",
      extractionError: null,
    },
  });

  try {
    const bytes = providedBytes ?? (await readStoredFile(document.storageKey)).bytes;
    const result = await extractDocumentText(bytes, document.mediaType);
    return prisma.$transaction(async (transaction) => {
      await transaction.documentChunk.deleteMany({ where: { documentId: document.id } });
      if (result.chunks.length > 0) {
        await transaction.documentChunk.createMany({
          data: result.chunks.map((chunk) => ({ ...chunk, documentId: document.id })),
        });
      }
      return transaction.assistantAttachment.update({
        where: { id: document.id },
        data: {
          extractionStatus: result.status,
          extractedText: result.text,
          extractionError: result.error,
          pageCount: result.pageCount,
          processedAt: new Date(),
        },
      });
    });
  } catch {
    return prisma.$transaction(async (transaction) => {
      await transaction.documentChunk.deleteMany({ where: { documentId: document.id } });
      return transaction.assistantAttachment.update({
        where: { id: document.id },
        data: {
          extractionStatus: "FAILED",
          extractedText: null,
          extractionError: "BuilderBridge could not access or process this file.",
          pageCount: null,
          processedAt: new Date(),
        },
      });
    });
  }
}
