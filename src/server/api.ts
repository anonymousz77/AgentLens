import type http from "http";
import { listSessionsSummary, getSessionDetail, getStats } from "../api/read";
import { getDemoSessions, getDemoSession, getDemoStats } from "./demo";

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
 * When opts.demo is true, all session/stats endpoints serve in-memory demo data
 * and the real database is never opened.
 */
export function handleApi(
  pathname: string,
  repoRoot: string,
  res: http.ServerResponse,
  opts: { demo?: boolean; autoDemo?: boolean } = {}
): boolean {
  const { demo = false, autoDemo = false } = opts;

  // /api/meta — always served; lets the frontend know whether to show the banner.
  if (pathname === "/api/meta") {
    sendJson(res, 200, { demo, autoDemo });
    return true;
  }

  if (demo) {
    if (pathname === "/api/sessions") {
      sendJson(res, 200, getDemoSessions());
      return true;
    }

    const sessionMatch = /^\/api\/sessions\/([^/]+)$/.exec(pathname);
    if (sessionMatch !== null) {
      const id = sessionMatch[1]!;
      const detail = getDemoSession(id);
      if (detail === null) {
        sendJson(res, 404, { error: "Session not found" });
      } else {
        sendJson(res, 200, detail);
      }
      return true;
    }

    if (pathname === "/api/stats") {
      sendJson(res, 200, getDemoStats());
      return true;
    }

    return false;
  }

  // ── Real DB paths ─────────────────────────────────────────────────────────────

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
