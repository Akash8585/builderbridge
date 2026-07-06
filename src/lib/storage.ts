import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

/**
 * File storage for user uploads (Field Tracking photos, Drawings).
 *
 * Two backends behind one function:
 * - S3-compatible object storage (Cloudflare R2, AWS S3, MinIO) when the
 *   S3_* env vars are configured — durable, works on serverless hosts.
 * - Local disk under public/uploads/ otherwise — dev convenience only.
 *   Local files do NOT survive a serverless redeploy; DEPLOYMENT.md requires
 *   configuring S3 storage for production.
 */

const s3Configured = !!(env.S3_ENDPOINT && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && env.S3_BUCKET);

let s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.S3_REGION, // Supabase: project region; R2: "auto"
      endpoint: env.S3_ENDPOINT,
      // Path-style addressing (bucket in the URL path, not the subdomain) —
      // required by Supabase Storage and MinIO, and fine for R2.
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

export function isDurableStorageConfigured(): boolean {
  return s3Configured;
}

/**
 * Stores a file and returns the public URL it will be served from.
 * `key` is a POSIX-style relative path, e.g. "tasks/<id>/<filename>".
 */
export async function uploadFile(key: string, bytes: Buffer, contentType: string): Promise<string> {
  if (s3Configured) {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET!,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      })
    );
    const base = (env.S3_PUBLIC_URL ?? `${env.S3_ENDPOINT}/${env.S3_BUCKET}`).replace(/\/$/, "");
    return `${base}/${key}`;
  }

  // Local-disk fallback (dev): write under public/uploads so Next serves it.
  const relativeParts = key.split("/");
  const dir = path.join(process.cwd(), "public", "uploads", ...relativeParts.slice(0, -1));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, relativeParts[relativeParts.length - 1]), bytes);
  return `/uploads/${key}`;
}

/** Builds a collision-resistant storage key from a user-provided filename. */
export function buildStorageKey(prefix: string, originalFilename: string): string {
  const safeName = originalFilename.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${prefix}/${Date.now()}-${safeName}`;
}
