import type http from "http";
import { listSessionsSummary, getSessionDetail, getStats } from "../api/read";

function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * Handles /api/* routes. Returns true if the pathname matched an API route.
 */
export function handleApi(
  pathname: string,
  repoRoot: string,
  res: http.ServerResponse
): boolean {
  if (pathname === "/api/sessions") {
    const sessions = listSessionsSummary(repoRoot);
    sendJson(res, 200, sessions);
    return true;
  }

  const sessionMatch = /^\/api\/sessions\/([^/]+)$/.exec(pathname);
  if (sessionMatch !== null) {
    const id = sessionMatch[1]!;
    const detail = getSessionDetail(repoRoot, id);
    if (detail === null) {
      sendJson(res, 404, { error: "Session not found" });
    } else {
      sendJson(res, 200, detail);
    }
    return true;
  }

  if (pathname === "/api/stats") {
    const stats = getStats(repoRoot);
    sendJson(res, 200, stats);
    return true;
  }

  return false;
}
