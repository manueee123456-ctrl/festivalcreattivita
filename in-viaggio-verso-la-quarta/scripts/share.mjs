import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

// Serve only the exported quiz, never the repository or its configuration files.
const html = await readFile(new URL("../../quiz-palloncini.html", import.meta.url));
const port = Number(process.env.PORT || 8080);
const routes = new Set(["/", "/quiz-palloncini.html", "/scarica"]);

createServer((request, response) => {
  const path = new URL(request.url, "http://quiz.invalid").pathname;
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    return response.end();
  }
  if (!routes.has(path)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return response.end("Pagina non trovata");
  }
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": html.byteLength,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...(path === "/scarica" ? {
      "Content-Disposition": 'attachment; filename="quiz-palloncini.html"',
    } : {}),
  });
  response.end(request.method === "HEAD" ? undefined : html);
}).listen(port, "0.0.0.0", () => {
  console.log(`Quiz pronto sulla porta ${port}. / per giocare, /scarica per il file HTML.`);
});
