// Builds the extension: pages, then self-contained content script and service worker.
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const run = (cmd) => execSync(cmd, { cwd: root, stdio: "inherit" });

rmSync(resolve(root, "dist"), { recursive: true, force: true });
run("npx vite build");
run("npx vite build --mode scripts");
mkdirSync(resolve(root, "dist/src/injected"), { recursive: true });
run("npx vite build --mode bridge");

// The service worker is an ES module, built as a single file so it has no shared imports.
run("npx vite build --mode worker");

// Content CSS may emit under a hashed/lib name — normalize to callledger-extension.css.
const cssCandidates = [
  "callledger-extension.css",
  "style.css",
  "content.css",
  "src/content/index.css",
];
let cssFound = false;
for (const candidate of cssCandidates) {
  const from = resolve(root, "dist", candidate);
  if (existsSync(from)) {
    const to = resolve(root, "dist/callledger-extension.css");
    if (from !== to) {
      cpSync(from, to);
    }
    cssFound = true;
    break;
  }
}
if (!cssFound) {
  // Fallback: copy source styles so the content_scripts css entry always exists.
  cpSync(resolve(root, "src/content/styles.css"), resolve(root, "dist/callledger-extension.css"));
}

const manifestPath = resolve(root, "dist/manifest.json");
if (!existsSync(manifestPath)) throw new Error("manifest.json was not copied into dist/");
const requiredFiles = [
  "src/content/index.js",
  "src/injected/ethereum-bridge.js",
  "callledger-extension.css",
  "src/background/service-worker.js",
  "index.html",
  "sidepanel.html",
  "icons/icon-128.png",
];
for (const f of requiredFiles) {
  if (!existsSync(resolve(root, "dist", f))) throw new Error(`Missing build output: dist/${f}`);
}
const content = readFileSync(resolve(root, "dist/src/content/index.js"), "utf8");
if (/^\s*import\s/m.test(content) || /\bfrom\s*["'][./]/.test(content)) {
  throw new Error("Content script still contains module imports; it will not load on X.");
}
console.log("\nBuild OK: dist/ is ready to load as an unpacked extension.");
