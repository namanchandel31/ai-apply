/**
 * @deprecated Prefer `npm run migrate` (runs run-migrations.js at repo root).
 */
const path = require("path");
const { spawnSync } = require("child_process");

const result = spawnSync(
  process.execPath,
  [path.join(__dirname, "..", "run-migrations.js")],
  { stdio: "inherit", env: process.env }
);

process.exit(result.status ?? 1);
