# Motion contract

`dist/ui/motion.js` is the source of truth for Web Animations and generated CSS tokens.
After changing it, run `npm run motion:generate`; `npm run motion:check` verifies CSS synchronization.

| Layer | Duration | Usage |
| --- | --- | --- |
| Instant | 0 ms | Navigation, focus, disabled and accessibility states |
| Fast | 160 ms | Hover, pressed, short feedback, disappearance |
| Standard | 200 ms | Local UI changes, functional mobile sheet resizing, game start |
| Enter | 260 ms | Existing bottom sheet entry and future large overlays |
| Exit | 180 ms | Overlay dismissal; always shorter than Enter |
| Board | 420 ms | Piece movement, including castling |
| Reveal | 500 ms | Reward scale/opacity and simultaneous rarity glow |

Use semantic easing: local/enter ease-out, exit ease-in, sheet deceleration,
neutral board movement, reward ease-out. Select the layer before adding an effect.
Do not add arbitrary durations, transition:all or decorative page transitions.
Main and nested navigation stays instant. Do not animate PageHeader, statistics
sections, card heights, width, margin, padding or page geometry. The existing
mobile dialog content-height animation is a functional exception that removes a jump.

Buttons animate filter (actual brightness feedback) and background-color, never
outline or disabled opacity. Focus is immediate; disabling cancels feedback immediately.
Read-only chess squares retain full opacity and contrast: aria-disabled blocks moves, not visibility.
Hover applies only to hover-capable devices; pressed feedback uses the same Fast layer.

Change application state immediately, then visualize it. Do not use an animation
or timeout to defer starting the action. Preserve deliberate post-game sequencing.
Replay pauses are pacing, not Board duration. Native smooth scroll communicates
position in the catalog; it has no fixed UI duration.

Every new effect must support prefers-reduced-motion: CSS disables animations and
transitions; JavaScript checks the preference before animating or awaiting motion;
programmatic scroll uses instant. Preserve feedback and functionality, with no extra
wait, spinner or removed information. Reward rarity retains its static accent.
