# Play styles: audit and integration plan (2026-09-13)

## Audit before implementation
Current source: local 4a9465f, published d3793e. Session creates target = player − 100, clamped 400–1600; seeded Gaussian session variance σ40, bounded ±120. Profile here previously meant strength settings, not personality. Stockfish19 WASM Worker uses Skill20, LimitStrength false, MultiPV min(32, legal count), depth9/nodes150000/movetime2500. These search settings do not depend on Elo. Last coherent batch feeds CP/mate normalization, loss, tactical guard and same-search depth2 perception. Pure selectCandidate chooses quality via continuous Elo probabilities, stronger fallback, weighted move, possible guard rescue and missed-tactic substitution. RNG is seeded per FEN; no opening book, only opening error multiplier .75. Timeout recovery can have only one evaluated candidate.

Pipeline: position/history → SF19 MultiPV → legal evaluated candidates + context + early snapshot → seeded Elo selector → legal move.

## Integration decision
Keep that selector byte-for-byte behavior for an absent/default style. Add a final style preference over a narrow envelope around its output: same quality category, CP/mate status/distance and guard status; loss difference ≤ .15 pawn. This also covers existing rescue/perception without duplicating either. Style cannot create an error category or choose a random legal move. Independent derived RNG means default seed stream stays unchanged. This bounds, but does not prove equality of playing strength.

## Ordered changes and verification
1. Add play-style.js: four actual coefficient vectors, deterministic cheap chess.js feature extraction, bounded weighted replacement. Features: check/king proximity, simplification, exposure, pawn structure/passed pawns/central activity and legal forcing replies. No new engine searches. Unit tests for semantics, color symmetry, configuration and envelope.
2. Extend strength profile with optional public `profile` enum; createDifficultyProfile retains positional API and adds optional options argument. Adapter applies style after Elo selection; persisted engine profiles already copied by state/archive. Validate unknown style; PGN records it. No character UI. Tests for default identity, seed, persistence and legal moves.
3. Add fixed-position diagnostic and real SF19 paired-color tournament: all six pairs at 600/1000/1400/1600 (current supported ceiling), matched seeds, normal search budget. Record actual terminal results separately from capped unfinished games; loss/rank, captures/checks, queen exchanges, material at move20, diversity, baseline-change fraction. Store PGNs and JSON. Balance findings cannot establish calibrated human Elo.
4. Inspect results, fix concrete regressions, full tests, PWA assets and report. No publication until requested.

## Risks and explicit limitations
Narrow pools may constrain visible style. Geometric attack/complexity features are proxies, not human comprehension; legal replies are not necessarily reasonable replies. No claims about future opponent choice. Mate utility must never be reported as centipawn loss. 1800 unsupported, not silently clamped and relabeled. Default behavior and engine lifecycle must remain unchanged. Future opening model can consume the same profile enum without adding unused opening settings now.
