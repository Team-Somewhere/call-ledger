// Builds the extension: pages, then self-contained content script and service worker.
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, renameSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const run = (cmd) => execSync(cmd, { cwd: root, stdio: "inherit" });

rmSync(resolve(root, "dist"), { recursive: true, force: true });
run("npx vite build");
run("npx vite build --mode scripts");

// The service worker is an ES module, built as a single file so it has no shared imports.
run("npx vite build --mode worker");

const manifestPath = resolve(root, "dist/manifest.json");
if (!existsSync(manifestPath)) throw new Error("manifest.json was not copied into dist/");
const requiredFiles = ["src/content/index.js", "callledger-extension.css", "src/background/service-worker.js", "index.html", "sidepanel.html", "icons/icon-128.png"];
for (const f of requiredFiles) {
  if (!existsSync(resolve(root, "dist", f))) throw new Error(`Missing build output: dist/${f}`);
}
const content = readFileSync(resolve(root, "dist/src/content/index.js"), "utf8");
if (/^\s*import\s/m.test(content) || /\bfrom\s*["'][./]/.test(content)) {
  throw new Error("Content script still contains module imports; it will not load on X.");
}
console.log("\nBuild OK: dist/ is ready to load as an unpacked extension.");
