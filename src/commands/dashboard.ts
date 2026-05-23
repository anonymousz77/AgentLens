import http from "http";
import { execSync } from "child_process";
import pc from "picocolors";
import path from "path";
import { isInitialized } from "../db/database";
import { handleApi } from "../server/api";
import { serveStatic } from "../server/static";

const DEFAULT_PORT = 4319;

function openBrowser(url: string): void {
  try {
    const cmd =
      process.platform === "win32"
        ? `start "" "${url}"`
        : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
    execSync(cmd, { stdio: "ignore" });
  } catch {
    // Silently skip — the URL is already printed
  }
}

export function runDashboard(repoRoot: string, opts: { port?: number }): void {
  if (!isInitialized(repoRoot)) {
    console.error(pc.red("Error: AgentLens is not initialised in this directory."));
    console.error(pc.dim("Run `agentlens init` first."));
    process.exit(1);
  }

  const port = opts.port ?? DEFAULT_PORT;

  // __dirname in the compiled output is dist/commands/
  // The dashboard static assets live at dist/dashboard/
  const staticRoot = path.join(__dirname, "..", "dashboard");

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const pathname = url.pathname;

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      res.end("Method Not Allowed");
      return;
    }

    try {
      const handled = handleApi(pathname, repoRoot, res);
      if (!handled) {
        serveStatic(staticRoot, req, res);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(pc.red("Request error:"), msg);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    }
  });

  server.listen(port, "127.0.0.1", () => {
    const url = `http://localhost:${port}`;
    console.log(
      `\n  ${pc.bold("AgentLens Dashboard")}  ${pc.dim("→")}  ${pc.cyan(url)}\n`
    );
    console.log(pc.dim("  Press Ctrl+C to stop.\n"));
    openBrowser(url);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        pc.red(`\n  Port ${port} is already in use. Try: agentlens dashboard --port <number>\n`)
      );
    } else {
      console.error(pc.red("Server error:"), err.message);
    }
    process.exit(1);
  });
}
