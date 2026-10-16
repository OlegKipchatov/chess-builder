import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
const release =
  process.env.GACHACHESS_RELEASE ||
  `${execFileSync("git", ["rev-parse", "--short", "HEAD"]).toString().trim()}-${Date.now()}`;
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/services/pwa",
      filename: "sw.ts",
      injectRegister: false,
      registerType: "prompt",
      manifest: {
        id: "./",
        name: "GachaChess — шахматы и коллекции",
        short_name: "GachaChess",
        lang: "ru",
        description: "Шахматы, игровые монеты и коллекционные скины фигур",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#111113",
        theme_color: "#111113",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,wasm,nnue,png,webmanifest,txt}"],
        globIgnores: ["**/package.tgz"],
        maximumFileSizeToCacheInBytes: 32 * 1024 * 1024,
      },
    }),
  ],
  define: { __APP_RELEASE__: JSON.stringify(release) },
  worker: { format: "es" },
  build: { target: "es2022", sourcemap: true, emptyOutDir: true },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
