import path from "path";

/**
 * Filesystem location of uploaded files.
 *
 * NEVER store under `public/` — files served from `public/` bypass auth.
 * Default is `storage/uploads` at the project root; override with
 * `UPLOAD_DIR` env var in production (e.g. an EFS/NFS mount or S3-backed FUSE).
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "storage/uploads";

export const MAX_UPLOAD_BYTES = Number(
  process.env.MAX_UPLOAD_BYTES ?? 25 * 1024 * 1024
);

/** Allowlist of MIME types we accept. */
export const ALLOWED_MIME_TYPES = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "text/plain",
  "text/csv",
  "text/markdown",
]);

/** Extensions we accept as a fallback when the browser sends an empty MIME. */
const ALLOWED_EXTENSIONS = new Set<string>([
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".pdf", ".zip",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".txt", ".csv", ".md",
]);

export function isAllowedFile(originalName: string, mimeType: string): boolean {
  if (mimeType && ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) return true;
  const ext = path.extname(originalName).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

/** Returns the URL we expose to clients for a given file ID. */
export function fileDownloadUrl(fileId: string): string {
  return `/api/files/${fileId}`;
}

/** Absolute filesystem path for a stored filename. Rejects path traversal. */
export function storedFilePath(fileName: string): string {
  const root = path.resolve(process.cwd(), UPLOAD_DIR);
  const resolved = path.resolve(root, fileName);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid file path");
  }
  return resolved;
}
