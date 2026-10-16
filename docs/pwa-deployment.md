# PWA build and deployment

Vite builds a static SPA into generated `dist/`. `vite-plugin-pwa` uses injectManifest with the typed custom service worker in `src/services/pwa/sw.ts`. All JS/CSS, lazy page chunks, Workers, WASM, NNUE, icons, manifest and engine license pages are precached. Source maps and the downloaded package archive are not runtime precache assets.

A deterministic content digest identifies the release. JavaScript and CSS have Vite content-hashed URLs; engine assets are pinned and checksum-verified. Installation uses four concurrent fetches with HTTP-cache bypass. Failure rejects the whole install and removes its partial cache. No automatic skipWaiting occurs.

Navigation always returns the installed release's cached HTML. It never mixes fresh network HTML with older chunks. Exact older URLs remain available from one preceding release until safe reload. Activation cleans only owned caches in the same scope; legacy `chess-vault-vN` caches are inspected before cleanup. Other applications' caches, localStorage and IndexedDB are untouched.

`SKIP_WAITING` and the previous UI's `ACTIVATE_UPDATE` command are accepted, allowing installed v132 clients to opt into the React release. The React update action is blocked during a game, mode, review or modal. Controller changes reload only at a safe, visible moment. First-install isolation reload follows the same safety gate. COOP/COEP/CORP response headers preserve threaded Stockfish; the single-thread fallback remains supported without isolation.

## Required gates

1. `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run motion:check`.
2. `npm run test:pwa:browser`: root/subpath cold offline, both AI paths, Autochess, active-game restore, resumable rewards, cached/cancelled analysis, real installed v132 upgrade and failed install.
3. `npm run test:stockfish:browser`: real threaded/single/fallback WASM, heap ownership, cancellation, analysis and mate exercises.
4. `npm run test:pwa:single`: repeat offline/upgrade without isolation.
5. Browser UI/layout and performance checks, including all modes, enlarged text, reduced motion, modals and training.
6. Publish a new private preview only after these gates; verify the deployed URL and its worker scope directly.

The upgrade test extracts baseline commit `ee7df974635bf7dd514c24e4d4a6b04bce3af8c6`, so CI checkout requires history. It serves that real predecessor, installs it, starts a game, intentionally fails the next install, retries, then accepts the update through the old Profile UI. It checks progress and exact prior Worker URLs after a cold offline reopen.

GitHub Pages only receives `dist/` from a successful main build. Migration pushes run validation but cannot invoke the production deployment job. Keep the migration on a separate branch; never merge or deploy main without explicit approval. Private previews need separate origins/scopes and unique addresses. Do not clear a user's progress to repair an update.

If browser QA is unavailable, report that gate as blocked; a successful unit test or build is not evidence of an installed-PWA upgrade or working published preview.
