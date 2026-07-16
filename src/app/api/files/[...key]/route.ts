import { requireStoredFileAccess } from "@/lib/file-access";
import {
  InvalidStorageRangeError,
  normalizeStorageKey,
  readStoredFile,
} from "@/lib/storage";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const user = await requireUser();
    const { key: segments } = await params;
    const key = normalizeStorageKey(segments.join("/"));
    await requireStoredFileAccess(user.id, key);

    const file = await readStoredFile(key, request.headers.get("range"));
    const filename = key.split("/").at(-1) ?? "file";
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Length": String(file.contentLength),
      "Content-Type": file.contentType,
      "X-Content-Type-Options": "nosniff",
    });
    if (file.contentRange) headers.set("Content-Range", file.contentRange);
    const body = new ArrayBuffer(file.bytes.byteLength);
    new Uint8Array(body).set(file.bytes);
    return new Response(body, {
      status: file.contentRange ? 206 : 200,
      headers,
    });
  } catch (error) {
    if (error instanceof InvalidStorageRangeError) {
      return new Response(null, {
        status: 416,
        headers: error.totalLength
          ? { "Content-Range": `bytes */${error.totalLength}` }
          : undefined,
      });
    }
    return Response.json({ error: "File not found or unavailable." }, { status: 404 });
  }
}
