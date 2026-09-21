import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const result = spawnSync(process.execPath, [
  fileURLToPath(new URL("../node_modules/@playwright/test/cli.js", import.meta.url)),
  "test",
  ...process.argv.slice(2),
], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  stdio: "inherit",
  env: {
    ...process.env,
    QUIZ_ENTRY_URL: new URL("../../quiz-palloncini.html", import.meta.url).href,
  },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
