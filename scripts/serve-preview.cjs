const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, process.env.PREVIEW_DIR || "../dist");
http
  .createServer((request, response) => {
    const requested = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    if (requested.startsWith("/auth/")) {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Referrer-Policy", "no-referrer");
    }
    let file = path.resolve(root, "." + requested);
    if (file !== root && !file.startsWith(root + path.sep)) {
      response.writeHead(403);
      return response.end();
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory())
      file = path.join(file, "index.html");
    if (!fs.existsSync(file) && fs.existsSync(file + ".html")) file += ".html";
    // Nested Expo routes can contain dynamic directories, e.g.
    // /activity/<id>/chat -> /activity/[id]/chat.html.
    if (!fs.existsSync(file)) {
      const segments = requested.split("/").filter(Boolean);
      let directory = root;
      for (const segment of segments.slice(0, -1)) {
        const exact = path.join(directory, segment);
        if (fs.existsSync(exact) && fs.statSync(exact).isDirectory()) {
          directory = exact;
        } else {
          const matches = fs
            .readdirSync(directory, { withFileTypes: true })
            .filter(
              (entry) => entry.isDirectory() && /^\[[^\]]+\]$/.test(entry.name),
            );
          if (matches.length !== 1) {
            directory = null;
            break;
          }
          directory = path.join(directory, matches[0].name);
        }
      }
      if (directory) {
        const nested = path.join(
          directory,
          `${segments.at(-1) ?? "index"}.html`,
        );
        if (fs.existsSync(nested)) file = nested;
      }
    }
    if (!fs.existsSync(file)) {
      const directory = path.dirname(file);
      if (fs.existsSync(directory) && fs.statSync(directory).isDirectory()) {
        const templates = fs
          .readdirSync(directory)
          .filter((name) => /^\[[^\]]+\]\.html$/.test(name));
        if (templates.length === 1) file = path.join(directory, templates[0]);
      }
    }
    if (!fs.existsSync(file)) file = path.join(root, "index.html");
    response.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".json": "application/json",
      }[path.extname(file)] ?? "application/octet-stream",
    );
    fs.createReadStream(file).pipe(response);
  })
  .listen(Number(process.env.PORT ?? 4173), "127.0.0.1");
