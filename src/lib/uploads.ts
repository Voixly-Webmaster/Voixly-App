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

const LOGO_TYPES = {
  png: "image/png",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
} as const;

export type LogoKind = keyof typeof LOGO_TYPES;

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** Recognize a real PNG, JPEG, GIF, or WebP. A renamed file is rejected. */
export function logoKind(bytes: Uint8Array): LogoKind | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

export function logoMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase().replace(".", "");
  if (ext === "jpg" || ext === "jpeg") return LOGO_TYPES.jpeg;
  if (ext === "gif") return LOGO_TYPES.gif;
  if (ext === "webp") return LOGO_TYPES.webp;
  return LOGO_TYPES.png;
}

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
