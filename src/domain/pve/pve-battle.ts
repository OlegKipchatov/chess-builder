import type { Color } from "chess.js";
import { recordCalendarGame } from "../activity/calendar-rewards.js";
import type { ActivityWallet } from "../activity/types.js";
import {
DEATH_RATE,
NODES,
PVE,
activeArmy,
damage,
deathPenalty,
earnXp,
encounter,
frontier,
homeSquare,
isUnlocked,
maxHp,
xpThreshold,
} from "./pve-model.js";
import type {
CombatUnit,
EnemyUnit,
NodeProgress,
PveAction,
PveBattle,
PveNode,
PveProfile,
PveReceipt,
PveUnit,
UnitChange
} from "./types.js";
const files = "abcdefgh";
const coords = (square: string) => [
  files.indexOf(square[0]),
  Number(square[1]) - 1,
];
const squareAt = (x: number, y: number) =>
  x >= 0 && x < 8 && y >= 0 && y < 8 ? files[x] + (y + 1) : null;
const orthogonal = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ],
  diagonal = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
export const livingUnits = (battle: PveBattle) =>
  battle.units.filter((unit) => unit.hp > 0);
export const unitAt = (battle: PveBattle, square: string | null | undefined) =>
  battle.units.find((unit) => unit.hp > 0 && unit.square === square);
// Derived from the last committed action, so reloads preserve the one-turn right.
export const enPassantTarget = (
  battle: PveBattle,
  unit: CombatUnit | undefined,
  to: string,
) => {
  const last = battle.lastEvent;
  if (
    !unit ||
    unit.type !== "p" ||
    unit.hp <= 0 ||
    unit.color !== battle.turn ||
    !last?.moved ||
    last.damage ||
    unitAt(battle, to)
  )
    return null;
  const target = unitAt(battle, last.to),
    direction = unit.color === "w" ? 1 : -1;
  if (
    !target ||
    target.type !== "p" ||
    target.color === unit.color ||
    target.id !== last.attackerId
  )
    return null;
  const start = target.color === "w" ? 2 : 7,
    end = start + (target.color === "w" ? 2 : -2);
  if (
    last.from !== target.square[0] + start ||
    last.to !== target.square[0] + end
  )
    return null;
  if (
    Number(unit.square[1]) !== end ||
    Math.abs(
      files.indexOf(unit.square[0]) - files.indexOf(target.square[0]),
    ) !== 1
  )
    return null;
  return to === target.square[0] + (end + direction) ? target : null;
};
// Threat geometry is advisory: HP chess permits every geometric move,
// including moving a king into an attack or capturing the opposing king.
export const attacksSquare = (
  battle: PveBattle,
  unit: CombatUnit | undefined,
  square: string,
) => {
  if (!unit || unit.hp <= 0 || unit.square === square) return false;
  const [x, y] = coords(unit.square),
    [tx, ty] = coords(square),
    dx = tx - x,
    dy = ty - y;
  if (unit.type === "p")
    return Math.abs(dx) === 1 && dy === (unit.color === "w" ? 1 : -1);
  if (unit.type === "n") return Math.abs(dx) * Math.abs(dy) === 2;
  if (unit.type === "k") return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  const diagonalLine = Math.abs(dx) === Math.abs(dy),
    straight = dx === 0 || dy === 0;
  if (!(
    (unit.type === "q" && (diagonalLine || straight)) ||
    (unit.type === "b" && diagonalLine) ||
    (unit.type === "r" && straight)
  ))
    return false;
  for (let step = 1; step < Math.max(Math.abs(dx), Math.abs(dy)); step++)
    if (
      unitAt(
        battle,
        squareAt(x + Math.sign(dx) * step, y + Math.sign(dy) * step),
      )
    )
      return false;
  return true;
};
export const isSquareAttacked = (
  battle: PveBattle,
  square: string,
  color: Color,
) =>
  livingUnits(battle).some(
    (unit) => unit.color === color && attacksSquare(battle, unit, square),
  );
export const isKingThreatened = (battle: PveBattle, color = battle.turn) => {
  const king = livingUnits(battle).find(
    (unit) => unit.color === color && unit.type === "k",
  );
  return (
    !!king && isSquareAttacked(battle, king.square, color === "w" ? "b" : "w")
  );
};
const pseudoMoves = (
  battle: PveBattle,
  unit: CombatUnit | undefined,
): PveAction[] => {
  if (!unit || unit.hp <= 0) return [];
  const [x, y] = coords(unit.square),
    moves: PveAction[] = [];
  const add = (dx: number, dy: number, slide = false) => {
    for (let step = 1; step <= (slide ? 7 : 1); step++) {
      const to = squareAt(x + dx * step, y + dy * step);
      if (!to) break;
      const target = unitAt(battle, to);
      if (target?.color !== unit.color) moves.push({ from: unit.square, to });
      if (target) break;
    }
  };
  if (unit.type === "p") {
    const direction = unit.color === "w" ? 1 : -1,
      one = squareAt(x, y + direction);
    if (one && !unitAt(battle, one)) {
      moves.push({ from: unit.square, to: one });
      const two = squareAt(x, y + 2 * direction);
      if (
        !unit.moved &&
        y === (unit.color === "w" ? 1 : 6) &&
        two &&
        !unitAt(battle, two)
      )
        moves.push({ from: unit.square, to: two });
    }
    for (const dx of [-1, 1]) {
      const to = squareAt(x + dx, y + direction),
        target = to && unitAt(battle, to);
      if (
        to &&
        ((target && target.color !== unit.color) ||
          enPassantTarget(battle, unit, to))
      )
        moves.push({ from: unit.square, to });
    }
  } else if (unit.type === "n")
    for (const [dx, dy] of [
      [1, 2],
      [2, 1],
      [-1, 2],
      [-2, 1],
      [1, -2],
      [2, -1],
      [-1, -2],
      [-2, -1],
    ])
      add(dx, dy);
  else
    for (const [dx, dy] of unit.type === "b"
      ? diagonal
      : unit.type === "r"
        ? orthogonal
        : [...orthogonal, ...diagonal])
      add(dx, dy, unit.type !== "k");
  return moves;
};
export const movesFor = (battle: PveBattle, unit: CombatUnit | undefined) =>
  pseudoMoves(battle, unit);
export const allMoves = (battle: PveBattle, color = battle.turn) =>
  livingUnits(battle)
    .filter((unit) => unit.color === color)
    .flatMap((unit) => movesFor(battle, unit));
export const positionKey = (battle: PveBattle) => {
  const units = livingUnits(battle),
    rights = units
      .filter((unit) => unit.type === "p" && unit.color === battle.turn)
      .flatMap((unit) =>
        movesFor(battle, unit)
          .filter((move) => enPassantTarget(battle, unit, move.to))
          .map((move) => `${move.from}${move.to}`),
      )
      .sort();
  return `${battle.turn}|${units
    .map(
      (unit) =>
        `${unit.id}:${unit.type}:${unit.square}:${unit.hp}:${unit.moved ? 1 : 0}`,
    )
    .sort()
    .join("|")}${rights.length ? "|ep:" + rights.join(",") : ""}`;
};
export const formation = (
  units: (PveUnit | EnemyUnit)[],
  color: Color,
): CombatUnit[] => {
  const used = new Set(),
    preferred = {
      k: ["e1"],
      r: ["a1", "h1"],
      n: ["b1", "g1"],
      b: ["f1", "c1"],
      q: ["d1"],
      p: ["a2", "c2", "e2", "g2", "b2", "f2", "d2", "h2"],
    };
  return [...units]
    .sort((a, b) => (a.type === "k" ? -1 : b.type === "k" ? 1 : 0))
    .map((unit) => {
      const square =
        (color === "w" && unit.id.startsWith("pve-unit-")
          ? homeSquare(unit.id)
          : null) ||
        [
          ...preferred[unit.type],
          ...[
            "a2",
            "b2",
            "c2",
            "d2",
            "e2",
            "f2",
            "g2",
            "h2",
            "a1",
            "b1",
            "c1",
            "d1",
            "f1",
            "g1",
            "h1",
          ],
        ].find((square) => !used.has(square))!;
      used.add(square);
      return {
        ...unit,
        color,
        square: color === "b" ? square[0] + (9 - Number(square[1])) : square,
        hp: maxHp(unit),
        moved: false,
      };
    });
};
export const beginPveBattle = (
  profile: PveProfile,
  nodeId: string,
  rng = Math.random,
): PveProfile => {
  const node = NODES.find((node) => node.id === nodeId);
  if (
    profile.battle ||
    !node ||
    !isUnlocked(profile, node) ||
    activeArmy(profile).length !== PVE.armySize
  )
    return profile;
  const enemy = encounter(profile, node),
    sequence = profile.sequence + 1;
  const battle: PveBattle = {
    id: `pve-${sequence}`,
    rulesVersion: 2,
    nodeId,
    rewardRoll: { coins: rng(), stones: rng() },
    phase: "playing",
    turn: "w",
    ply: 0,
    units: [
      ...formation(activeArmy(profile), "w"),
      ...formation(enemy.units, "b"),
    ],
    xp: {},
    positions: {},
    lastEvent: null,
    result: null,
    settled: false,
  };
  battle.positions[positionKey(battle)] = 1;
  const record = profile.nodes[nodeId] || {
    attempts: 0,
    wins: 0,
    openedAt: profile.stats.battles,
  };
  return {
    ...profile,
    revision: profile.revision + 1,
    sequence,
    battle,
    nodes: {
      ...profile.nodes,
      [nodeId]: { ...record, attempts: record.attempts + 1 },
    },
  };
};
export const killXp = (attacker: CombatUnit, target: CombatUnit) =>
  Math.max(
    4,
    Math.round(
      16 *
        (1 + 0.2 * (target.level - 1)) *
        Math.max(0.4, Math.min(1.6, 1 + 0.2 * (target.level - attacker.level))),
    ),
  );
// A surviving target blocks the attacker; every hit still spends one turn.
const applyAction = (battle: PveBattle, action: PveAction): PveBattle => {
  const attacker = unitAt(battle, action.from)!;
  const next: PveBattle = {
    ...battle,
    units: battle.units.map((unit) => ({ ...unit })),
    xp: { ...battle.xp },
  };
  const passant = enPassantTarget(battle, attacker, action.to);
  const own = next.units.find((unit) => unit.id === attacker.id)!,
    target = passant
      ? next.units.find((unit) => unit.id === passant.id)
      : unitAt(next, action.to),
    hit = target ? Math.min(target.hp, damage(own)) : 0;
  let killed = false;
  if (target) {
    target.hp -= hit;
    killed = target.hp === 0;
    if (killed && own.color === "w")
      next.xp[own.id] = (next.xp[own.id] || 0) + killXp(own, target);
  }
  if (!target || killed) own.square = action.to;
  own.moved = true;
  const promoted =
    own.type === "p" && own.square[1] === (own.color === "w" ? "8" : "1");
  if (promoted) {
    const health = own.hp / maxHp(own);
    own.type = "q";
    own.hp = Math.max(1, Math.round(health * maxHp(own)));
  }
  next.lastEvent = {
    from: action.from,
    to: action.to,
    attackerId: own.id,
    targetId: target?.id || null,
    targetSquare: target?.square || null,
    enPassant: !!passant,
    damage: hit,
    killed,
    moved: !target || killed,
    promoted,
  };
  next.turn = battle.turn === "w" ? "b" : "w";
  next.ply++;
  return next;
};
export const adjudicateBattle = (battle: PveBattle): PveBattle => {
  if (battle.phase !== "playing") return battle;
  const fallen = battle.units.find(
    (unit) => unit.type === "k" && unit.hp === 0,
  );
  if (fallen)
    return {
      ...battle,
      phase: "result",
      result: {
        outcome: fallen.color === "b" ? "win" : "loss",
        reason: "king",
      },
    };
  if (
    livingUnits(battle).some(
      (unit) => unit.color === battle.turn && movesFor(battle, unit).length,
    )
  )
    return battle;
  return {
    ...battle,
    phase: "result",
    result: { outcome: "draw", reason: "no-moves" },
  };
};
export const resumePveBattle = (profile: PveProfile): PveProfile => {
  if (!profile.battle) return profile;
  const battle = adjudicateBattle(profile.battle);
  return battle === profile.battle
    ? profile
    : { ...profile, revision: profile.revision + 1, battle };
};
// No storage or animation here: one action, one turn, no automatic counterattack.
export const resolveAction = (
  battle: PveBattle,
  action: PveAction,
  { track = true } = {},
): PveBattle => {
  if (battle.phase !== "playing") return battle;
  const attacker = unitAt(battle, action?.from);
  if (
    !attacker ||
    attacker.color !== battle.turn ||
    !movesFor(battle, attacker).some((move) => move.to === action.to)
  )
    return battle;
  const next = adjudicateBattle(applyAction(battle, action));
  if (track) {
    next.positions = { ...battle.positions };
    const key = positionKey(next);
    next.positions[key] = (next.positions[key] || 0) + 1;
    const reason =
      next.ply >= PVE.maxPlies
        ? "limit"
        : next.positions[key] >= 3
          ? "repetition"
          : null;
    if (reason && next.phase === "playing") {
      next.phase = "result";
      next.result = { outcome: "draw", reason };
    }
  }
  return next;
};
export const playPveAction = (
  profile: PveProfile,
  action: PveAction,
): PveProfile => {
  if (!profile.battle) return profile;
  const battle = resolveAction(profile.battle, action);
  return battle === profile.battle
    ? profile
    : { ...profile, revision: profile.revision + 1, battle };
};
export const resignPve = (profile: PveProfile): PveProfile =>
  !profile.battle || profile.battle.phase !== "playing"
    ? profile
    : {
        ...profile,
        revision: profile.revision + 1,
        battle: {
          ...profile.battle,
          phase: "result",
          result: { outcome: "loss", reason: "resigned" },
        },
      };
// Wallet, unit changes, node clear and receipt are committed in a single write.
export const pveRewards = (
  battle: PveBattle,
  node: PveNode,
  first: boolean,
) => {
  const outcome = battle.result!.outcome;
  const ranges = node.boss
    ? { win: [23, 33], draw: [15, 25], loss: [10, 20] }
    : { win: [12, 17], draw: [8, 13], loss: [5, 10] };
  const roll = (key: "coins" | "stones") => {
    const saved = battle.rewardRoll?.[key];
    if (
      typeof saved === "number" &&
      Number.isFinite(saved) &&
      saved >= 0 &&
      saved < 1
    )
      return saved;
    // Older saved battles have no roll: a stable fallback prevents reload rerolls.
    let hash = 2166136261;
    for (const char of `${battle.id}:${battle.nodeId}:${key}`)
      hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return (hash >>> 0) / 4294967296;
  };
  const pick = (range: number[], key: "coins" | "stones") =>
    range[0] + Math.floor(roll(key) * (range[1] - range[0] + 1));
  const earlyResign =
    battle.result!.reason === "resigned" && Math.ceil(battle.ply / 2) < 10;
  const bonusCoins = first ? (node.boss ? 10 : node.bonus ? 6 : 5) : 0,
    bonusStones = first ? (node.boss ? 3 : node.bonus ? 2 : 1) : 0;
  return {
    coins: (earlyResign ? 0 : pick(ranges[outcome], "coins")) + bonusCoins,
    stones:
      pick(
        outcome === "win" ? [2, 3] : outcome === "draw" ? [1, 2] : [1, 1],
        "stones",
      ) + bonusStones,
    cores: outcome === "win" && node.boss ? 1 : 0,
    bonusCoins,
    bonusStones,
  };
};
export const settlePve = <T extends ActivityWallet & { pve: PveProfile }>(
  wallet: T,
  now = new Date().toISOString(),
): T => {
  const profile = wallet.pve,
    battle = profile?.battle;
  if (!battle || battle.phase !== "result" || !battle.result || battle.settled)
    return wallet;
  const node = NODES.find((node) => node.id === battle.nodeId)!,
    win = battle.result.outcome === "win",
    first = win && !profile.cleared.includes(node.id);
  const levelCap = first && node.boss ? PVE.bossCap : profile.levelCap;
  const { coins, stones, cores, bonusCoins, bonusStones } = pveRewards(
    battle,
    node,
    first,
  );
  const record = profile.nodes[node.id] || {
      attempts: 1,
      wins: 0,
      openedAt: 0,
    },
    wins = record.wins + (win ? 1 : 0);
  const deaths = { ...profile.stats.deaths },
    changes: UnitChange[] = [];
  const units = profile.units.map((unit) => {
    const fighter = battle.units.find((row) => row.id === unit.id);
    if (!fighter) return unit;
    const earned =
      (battle.xp[unit.id] || 0) +
      (win && fighter.hp > 0 ? (node.boss ? 12 : 8) : 0);
    // Penalty uses the pre-battle type/level and is capped to one lost level.
    const penalized = fighter.hp === 0 ? deathPenalty(unit) : unit;
    const next = earnXp(penalized, earned, levelCap);
    if (fighter.hp === 0) deaths[unit.type] = (deaths[unit.type] || 0) + 1;
    changes.push({
      id: unit.id,
      type: unit.type,
      square: fighter.square,
      beforeLevel: unit.level,
      afterLevel: next.level,
      beforeXp: unit.xp,
      afterXp: next.xp,
      earned,
      penalty:
        fighter.hp === 0
          ? Math.ceil(xpThreshold(unit.level) * DEATH_RATE[unit.type])
          : 0,
      died: fighter.hp === 0,
    });
    return next;
  });
  const result: PveReceipt = {
    ...battle.result,
    id: battle.id,
    nodeId: node.id,
    coins,
    stones,
    cores,
    bonusCoins,
    bonusStones,
    first,
    levelCap,
    changes,
    plies: battle.ply,
    finishedAt: now,
  };
  const cleared = first ? [...profile.cleared, node.id] : profile.cleared;
  const nodes: Record<string, NodeProgress> = {
    ...profile.nodes,
    [node.id]: { ...record, wins },
  };
  const nextFrontier = frontier({ ...profile, cleared });
  for (const row of NODES)
    if (row.step === nextFrontier && !nodes[row.id])
      nodes[row.id] = {
        attempts: 0,
        wins: 0,
        openedAt: profile.stats.battles + 1,
      };
  const next: PveProfile = {
    ...profile,
    revision: profile.revision + 1,
    units,
    levelCap,
    stones: profile.stones + stones,
    cores: profile.cores + cores,
    cleared,
    nodes,
    lastResult: result,
    battle: { ...battle, settled: true, result },
    stats: {
      ...profile.stats,
      battles: profile.stats.battles + 1,
      wins: profile.stats.wins + (win ? 1 : 0),
      draws: profile.stats.draws + (battle.result.outcome === "draw" ? 1 : 0),
      deaths,
      recent: [
        ...profile.stats.recent,
        {
          nodeId: node.id,
          outcome: result.outcome,
          levels: units.filter((row) => row.active).map((row) => row.level),
          deaths: changes.filter((row) => row.died).length,
          stones,
          plies: battle.ply,
        },
      ].slice(-30),
    },
  };
  return {
    ...recordCalendarGame(wallet, { won: win, mode: "pve", finishedAt: now }),
    coins: wallet.coins + coins,
    pve: next,
  };
};
export const returnToMap = (profile: PveProfile): PveProfile =>
  profile.battle?.settled
    ? { ...profile, revision: profile.revision + 1, battle: null }
    : profile;
export const pveBoardAdapter = (battle: PveBattle) => ({
  board: () =>
    Array.from({ length: 8 }, (_, row) =>
      Array.from(
        { length: 8 },
        (_, col) => unitAt(battle, files[col] + (8 - row)) || null,
      ),
    ),
  moves: ({ square }: { square: string }) =>
    battle.turn === "w" && unitAt(battle, square)?.color === "w"
      ? movesFor(battle, unitAt(battle, square))
      : [],
  history: () => (battle.lastEvent ? [battle.lastEvent] : []),
  turn: () => battle.turn,
  isCheck: () => isKingThreatened(battle),
});
