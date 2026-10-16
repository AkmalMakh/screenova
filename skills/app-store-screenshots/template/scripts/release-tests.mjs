// The release gate selects repository-relative files; both suites run in full
// because browser rendering, private-storage contracts and shared config cross
// the static import graph. No selected file can silently disappear.
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(app, "../../..");
const selected = process.argv.slice(2);
if (!selected.length || selected.some(file => !existsSync(resolve(root, file)))) {
  console.error("Release test selection is empty or contains missing files");
  process.exit(1);
}
for (const args of [["test"], ["run", "check"], ["run", "build"], ["run", "test:e2e"]]) {
  const result = spawnSync("npm", args, { cwd: app, env: process.env, stdio: "inherit", timeout: 600_000 });
  if (result.error || result.status !== 0) {
    console.error(`Release check failed: npm ${args.join(" ")}`);
    process.exit(result.status || 1);
  }
}
