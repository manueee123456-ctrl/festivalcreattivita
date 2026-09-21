import { readFile, writeFile } from "node:fs/promises";

const source = new URL("../dist/index.html", import.meta.url);
const destination = new URL("../../quiz-palloncini.html", import.meta.url);
let html = await readFile(source, "utf8");
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
if (scripts.length !== 1 || /\bsrc\s*=/.test(scripts[0][1])) {
  throw new Error("Expected one fully inlined JavaScript bundle");
}
// Rollup emits an IIFE. Execute it as a classic inline script, after #root,
// rather than a module in <head>: file:// needs neither CORS nor module loads.
const script = scripts[0];
if (/\bimport\.meta\b/.test(script[2])) throw new Error("The standalone bundle must not use import.meta");
html = html.replace(script[0], "").replace(/^[ \t]+$/gm, "").replace("</body>", () => `<script>\n${script[2]}\n</script>\n  </body>`);
if (/<link\b[^>]*\b(?:href|rel)\s*=/i.test(html)
  || /\b(?:src|href)=["'](?:https?:|file:|\/src\/)/i.test(html)
  || /url\(["']?#/i.test(html)) {
  throw new Error("The standalone export still contains an external or URL-based SVG resource");
}
// Keep the SIL Open Font License notices with the embedded font binaries.
const licenses = await Promise.all(["fredoka", "nunito"].map((font) =>
  readFile(new URL(`../node_modules/@fontsource-variable/${font}/LICENSE`, import.meta.url), "utf8")
));
const notices = licenses.join("\n\n").replaceAll("-->", "--&gt;");
html = html.replace("</head>", () => `<!-- Embedded fonts: license notices\n${notices}\n-->\n  </head>`);
await writeFile(source, html);
await writeFile(destination, html);
console.log("Esportato: ../quiz-palloncini.html (versione 2, autonoma e utilizzabile senza rete)");
