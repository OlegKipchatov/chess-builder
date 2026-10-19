# Modal sheet implementation — 2026-10-19

## Decision

Keep the native `<dialog>` in the shared OverlayProvider and centralize the
transient gesture controller in useSheetGesture. Preserve the existing focus,
post-game sequencing, motion tokens, themes and offline bundle.

Alternatives reviewed against official sources:
- https://github.com/emilkowalski/vaul — its maintainer marks the repository unmaintained.
- https://github.com/Temzasse/react-modal-sheet — requires Motion; focus trapping
  and other accessibility integration must be supplied separately. Its API is
  useful for multi-detent sheets, which GachaChess does not currently need.

Neither provides enough benefit here to replace the existing native modal.
There are no new dependencies or network resources.

## Gesture contract

Header: drag both ways; mouse/pen enabled only in the mobile layout.
Body: touch drag downward only when all ancestors start at scrollTop=0;
interactive elements and horizontal overflow excluded. The touchmove listener
is non-passive only on the current dialog, to coordinate native scrolling on iOS.
Direction locks after 8px. Upward offset tends to -28px; downward offset follows
the finger. Dismiss after clamp(25% height, 64px, 120px), or a recent downward
velocity over 0.65px/ms with at least 24px travel. Pointer cancellation never
commits dismissal. Reduced motion disables settling/exit animations.

Upward release settles over 360ms with a gentle deceleration; a short downward
drag still returns over 200ms. The mobile close icon has a transparent background
and a 44px target inset 4px from the top/right edges (respecting right safe-area).

The close icon belongs to the shared header, separate from primary actions.
No generic text close action is rendered. State stays out of the move loop.

## Verification limits

Automated component tests cover gesture directions, cancellation, scroll and
input exclusion, sequencing, focus, reduced motion and cleanup. Real iOS touch,
visual layout, and installed-PWA upgrade must also be reviewed in the browser;
a jsdom component test cannot establish those results.

## Delivery checks

- Production build, strict TypeScript, ESLint and motion-token consistency passed.
- Domain suite: 375 passing tests. React suite includes the shared gesture tests.
- No browser QA was run: the managed environment has no control-browser skill.
  Touch-device visual review, both browser Stockfish modes and installed-PWA
  upgrade/offline scenarios are explicitly unverified for this delivery.
- The Vite release hash and all changed JS/CSS URLs are generated from source;
  the service worker precache includes the local bundle and engine assets.
