import fs from "fs";
import path from "path";
import type http from "http";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
};

export function serveStatic(
  staticRoot: string,
  req: http.IncomingMessage,
  res: http.ServerResponse
): void {
  const rawPath = req.url ?? "/";
  const urlPath = rawPath.split("?")[0] ?? "/";

  // Resolve and guard against path traversal
  const resolved = path.resolve(staticRoot, urlPath === "/" ? "index.html" : urlPath.replace(/^\//, ""));
  if (!resolved.startsWith(path.resolve(staticRoot))) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  let filePath = resolved;

  if (!fs.existsSync(filePath)) {
    // SPA fallback — any unknown path serves index.html
    filePath = path.join(staticRoot, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("Dashboard not built. Run `npm run build` first.");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] ?? "application/octet-stream";

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch {
    res.writeHead(500);
    res.end("Internal Server Error");
  }
}
