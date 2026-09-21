import { copyFile } from "node:fs/promises";

// A single, ready-to-open HTML: scripts, styles and the original pictures are
// embedded by vite-plugin-singlefile. Do not overwrite the Festival homepage.
const source = new URL("../dist/index.html", import.meta.url);
const destination = new URL("../../quiz-palloncini.html", import.meta.url);
await copyFile(source, destination);
console.log("Esportato: ../quiz-palloncini.html");
