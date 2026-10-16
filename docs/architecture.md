# React architecture

## Dependency direction

`app → pages → features → services/domain/shared`. Pure domain modules do not import React, browser persistence, Worker constructors or page components. Engine orchestration belongs to services, even when it performs chess calculations. Upstream chess.js and Stockfish binaries are dependencies, not rewritten first-party code.

The app is a Vite SPA. TanStack Router hash history supports GitHub Pages without server rewrites. Pages use TanStack lazyRouteComponent within a persistent React shell. Router preloading resolves route chunks before rendering, avoiding a second Suspense import waterfall. Legacy `#archive`, `#analysis` and `#minigames` links map to appropriate current screens. Route guards retain active chess sessions; navigation does not recreate the vault. Router scroll restoration and a scoped history-return record restore archive position/focus. TanStack Virtual applies only to archives over 50 entries.

TanStack Start does not currently provide sufficient benefit: GitHub Pages cannot execute request-time SSR; core gameplay requires client services and offline state. Selected static pages could be prerendered later, but no hydration dependency is imposed on chess. Domain/adapter separation permits a future server host without requiring one today.

## State ownership

`VaultProvider` owns a typed external store. `useVault(selector)` uses useSyncExternalStore and structural reuse of unchanged slices. A move does not invalidate collection/wallet consumers unnecessarily. There is no global per-move Context value and no Redux/Zustand dependency.

`useGameSession` owns explicit idle/thinking/saving/animating/failed and result transitions, board cursor, promotion commands and session generation. Persisted game configuration is separate from transient interaction state. It freezes the final position until settlement and the post-game flow finish. `RewardProcessor` resumes pending quality analysis without duplicating paid rewards.

`useGameAnalysis` owns an AbortController and job generation. Results must match both the entry and source PGN; compatibility gates cached analysis. Generation is checked again inside the persistence queue. `GameReview` owns playback, hints and variation position. `MatePractice` owns its exercise controller, opponent presentation and attempt counts.

`useHunt`, `useAutochess` and `usePveBattle` own their mode-specific transitions. React reducers/hooks orchestrate framework-independent rules. PvE move and settlement persist atomically. Autochess has its own existing storage key and lock, and preserves old shop/reserve versions.

`ThemeProvider`, `OverlayProvider` and `PwaProvider` have narrow responsibilities. Dialog content is React, with native modal focus containment, static-heading focus, focus return and controlled mobile transitions. PWA update reloads wait for safe app state, closed dialogs and a visible document.

## Board

`Chessboard` renders cells and a separate memoized piece layer. Stable IDs reconstructed from move history support captures, castling, en passant and promotion. Only changed piece props trigger piece work; measured movement uses refs and cancellable WAAPI, while React remains the source of structure and position. Keyboard arrows and legal destinations use the same interaction contract as touch/click. Domain legality stays outside the board.

History controls interpolate their own thumb without updating board state at frame frequency. Board movement is 420 ms; Autochess uses 160 ms and the existing controller pace. PvE sequences approach, impact and return, preserving surviving targets and health transitions. All paths respect reduced motion.

## Engines

Each feature owns its engine or controller. Engines initialize lazily, use typed request IDs, explicit deadlines and bounded retries. Session generations fence stale messages. Termination removes handlers and timers; Stockfish waits for nested Worker retirement acknowledgement before allocating a replacement heap, with a bounded forced shutdown fallback. Strict Mode mount/cleanup/remount is tested.

Stockfish 19 selects threaded WASM from capabilities (isolation, SharedArrayBuffer, WebAssembly); initialization failure can fall back to the pinned single-thread runtime. There are no User-Agent branches. Cognitive and PvE have distinct bundled Workers. Analysis clients dispose on completion, cancellation and route exit.

## Persistence

`services/persistence/state.ts` validates and migrates old formats. `vault-store.ts` serializes commands, obtains a Web Lock when available, rereads the current snapshot, applies a pure transformation, writes one JSON snapshot, then publishes. Failed writes do not publish rewards/purchases. Corrupt storage is preserved and blocks destructive replacement. Individual archive objects and unchanged state slices retain identity after unrelated transactions.

Fixtures in `tests/fixtures/persistence` were produced using the unmodified v132 implementation. They cover v1/v2, a rich v3 active game, analysis, equipment/activity, PvE battle and Autochess. Upgrading storage has no reset step. Progress is origin-specific; changing a private preview origin does not move another origin's browser data.

## Build and validation

Only `src/`, `public/`, configuration and scripts are canonical. `dist/` and engine downloads are generated. The baseline remains available at `ee7df974635bf7dd514c24e4d4a6b04bce3af8c6`; the PWA upgrade test extracts that exact source, so it exercises a real preceding service worker and UI.

Node/tsx preserves domain regressions. Vitest/Testing Library covers React state, focus, routes, Worker ownership and transactions. Browser suites exercise the production build; the Stockfish probe is compiled separately from the same services and is never included in the application precache. Browser layout/performance and installed-update results must be reported separately from DOM/unit results.
