import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT || 5173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
};

function safePath(url) {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const normalized = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const target = resolve(join(root, normalized === "/" ? "index.html" : normalized));
  return target.startsWith(root) ? target : join(root, "index.html");
}

const server = createServer((request, response) => {
  const target = safePath(request.url || "/");
  const file = existsSync(target) && statSync(target).isDirectory() ? join(target, "index.html") : target;

  if (!existsSync(file)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const ext = extname(file);
  const stats = statSync(file);
  const range = request.headers.range;

  if (ext === ".mp4" && range) {
    const match = range.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : stats.size - 1;
      const chunkSize = end - start + 1;
      response.writeHead(206, {
        "content-type": "video/mp4",
        "content-length": chunkSize,
        "content-range": `bytes ${start}-${end}/${stats.size}`,
        "accept-ranges": "bytes",
        "cache-control": "public, max-age=604800",
      });
      createReadStream(file, { start, end }).pipe(response);
      return;
    }
  }

  const headers = {
    "content-type": types[ext] || "application/octet-stream",
    "content-length": stats.size,
    "accept-ranges": ext === ".mp4" ? "bytes" : "none",
    "cache-control": ext === ".mp4" ? "public, max-age=604800" : "no-cache",
  };

  response.writeHead(200, headers);
  createReadStream(file).pipe(response);
});

server.listen(port, () => {
  console.log(`AI site running at http://localhost:${port}`);
});
