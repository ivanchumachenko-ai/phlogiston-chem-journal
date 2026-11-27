import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readdir, readFile } from "node:fs/promises";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { metaImagesPlugin } from "./vite-plugin-meta-images";
import { VitePWA } from "vite-plugin-pwa";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// Production builds use relative paths so the very same files work both on
// GitHub Pages (/phlogiston-chem-journal/) and from the offline ZIP served at
// the root of a local web server (python3 -m http.server).
const isBuild = process.argv.includes("build") || process.env.PHLOGISTON_BUILD === "1";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === "isolated" ? [{
      name: "isolated-journal-content-policy",
      transformIndexHtml() {
        return [{
          tag: "meta",
          injectTo: "head-prepend" as const,
          attrs: {
            "http-equiv": "Content-Security-Policy",
            content: "connect-src 'self'; img-src 'self' data: blob:; object-src 'none'; base-uri 'none'; form-action 'none'",
          },
        }];
      },
    }] : []),
    {
      name: "phlogiston-legal-files",
      apply: "build",
      async generateBundle() {
        const notices = await readdir(path.resolve(import.meta.dirname, "licenses"));
        const files = ["LICENSE", "THIRD_PARTY_NOTICES.txt", ...notices
          .filter((name) => name.endsWith(".txt"))
          .map((name) => `licenses/${name}`)];

        for (const fileName of files) {
          const source = await readFile(path.resolve(import.meta.dirname, fileName));
          this.emitFile({ type: "asset", fileName, source });
        }
      },
    },
    runtimeErrorOverlay(),
    tailwindcss(),
    metaImagesPlugin(),
    nodePolyfills({
      include: ['path', 'stream', 'util', 'url', 'buffer', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'phlogiston-sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png'],
      manifest: {
        name: mode === 'isolated' ? 'Phlogiston — личный журнал' : 'Phlogiston',
        short_name: 'Phlogiston',
        description: 'Offline reagent calculator for synthetic chemists',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: './',
        start_url: './',
        icons: [
          {
            src: 'favicon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'favicon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      injectManifest: {
        globPatterns: [
          "**/*.html",
          "assets/**/*.{js,css,png,jpg,svg,woff2,wasm,json}",
          "LICENSE",
          "THIRD_PARTY_NOTICES.txt",
          "licenses/*",
        ],
        maximumFileSizeToCacheInBytes: 30000000,
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  base: isBuild ? "./" : "/phlogiston-chem-journal/",
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    license: { fileName: "licenses/npm.md" },
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    assetsInlineLimit(filePath) {
      // The offline PDF renderer copies styles into a document with no stylesheet requests.
      if (filePath.includes("@fontsource-variable/") && filePath.endsWith(".woff2")) return true;
    },
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  define: {
    "process.env": {},
    global: "window",
  },
}));
