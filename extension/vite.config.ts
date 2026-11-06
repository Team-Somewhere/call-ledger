import { defineConfig, type Plugin, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { copyFileSync, mkdirSync, cpSync } from "node:fs";

/**
 * Chrome loads MV3 content scripts as classic scripts and service workers as
 * modules. Content scripts therefore must be single self-contained files with
 * no `import` statements, so they are built separately as IIFEs. Pages
 * (popup, side panel) build normally.
 *
 * The manifest, icons and HTML pages are copied into dist/ so the folder can be
 * loaded directly as an unpacked extension.
 */

const contentEntry = resolve(__dirname, "src/content/index.tsx");
const workerEntry = resolve(__dirname, "src/background/service-worker.ts");

function copyStatic(): Plugin {
  return {
    name: "callledger-copy-static",
    apply: "build",
    closeBundle() {
      copyFileSync(resolve(__dirname, "manifest.json"), resolve(__dirname, "dist/manifest.json"));
      mkdirSync(resolve(__dirname, "dist/icons"), { recursive: true });
      cpSync(resolve(__dirname, "public/icons"), resolve(__dirname, "dist/icons"), { recursive: true });
    },
  };
}

export default defineConfig(({ mode }): UserConfig => {
  // Second pass: content script and service worker, each as a single file.
  if (mode === "scripts") {
    return {
      publicDir: false,
      build: {
        outDir: "dist",
        emptyOutDir: false,
        sourcemap: false,
        minify: "esbuild",
        lib: {
          entry: { content: contentEntry },
          formats: ["iife"],
          name: "CallLedgerContent",
          fileName: () => "src/content/index.js",
        },
        rollupOptions: { output: { inlineDynamicImports: true } },
      },
    };
  }

  if (mode === "worker") {
    return {
      publicDir: false,
      build: {
        outDir: "dist",
        emptyOutDir: false,
        sourcemap: false,
        minify: "esbuild",
        lib: {
          entry: { "service-worker": workerEntry },
          formats: ["es"],
          fileName: () => "src/background/service-worker.js",
        },
        rollupOptions: { output: { inlineDynamicImports: true } },
      },
    };
  }

  return {
    base: "./",
    plugins: [react(), copyStatic()],
    publicDir: false,
    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: false,
      minify: "esbuild",
      rollupOptions: {
        input: {
          popup: resolve(__dirname, "index.html"),
          sidepanel: resolve(__dirname, "sidepanel.html"),
        },
        output: {
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
    },
  };
});
