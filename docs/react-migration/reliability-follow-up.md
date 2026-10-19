# Reliability follow-up — 2026-10-19

Local changes only; no publication or production update.

- A successful explicit vault reread clears a previous read error. Failed reads
  leave the error and original stored bytes intact; writes remain blocked.
- The shell subscribes to storage errors independently of game snapshots and
  offers a retry. It does not erase or replace malformed saves to recover.
- Quality reward evaluation and persistence failures are separate. A failed
  write retains the calculated result in memory and exposes a retry action.
  Retrying does not rerun the engine or replace a valid result with fallback.
  Existing transactional, exactly-once reward rules remain authoritative.
- Lock acquisition failures return the same typed transaction failure as
  storage failures, permitting subsequent retry without an unhandled rejection.
- Chessboards use a single roving Tab stop. Arrow keys follow visual orientation,
  stay within board edges, and preserve read-only move blocking.

Regression tests cover reread recovery, malformed-data protection, lock failure,
reward write retry, engine fallback diagnostics, late results after unmount,
shell error subscriptions, and keyboard traversal in both orientations.

Real-device Safari, browser layout and installed-PWA checks must still run before
publication. This follow-up does not certify those checks or modify caching.
