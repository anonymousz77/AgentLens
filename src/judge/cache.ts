import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

interface CacheEntry {
  response: string;
  createdAt: string;
}

export function computeCacheKey(
  diffPatch: string,
  prompt: string,
  modelId: string
): string {
  return crypto
    .createHash("sha256")
    .update(`${diffPatch}\n---\n${prompt}\n---\n${modelId}`)
    .digest("hex");
}

export function getCached(key: string, cacheDir: string): string | null {
  const filePath = path.join(cacheDir, `${key}.json`);
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const entry = JSON.parse(raw) as CacheEntry;
    return typeof entry.response === "string" ? entry.response : null;
  } catch {
    return null;
  }
}

export function setCached(
  key: string,
  response: string,
  cacheDir: string
): void {
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    const entry: CacheEntry = { response, createdAt: new Date().toISOString() };
    fs.writeFileSync(
      path.join(cacheDir, `${key}.json`),
      JSON.stringify(entry),
      "utf8"
    );
  } catch {
    // Cache write failures are non-fatal — we just skip caching.
  }
}
