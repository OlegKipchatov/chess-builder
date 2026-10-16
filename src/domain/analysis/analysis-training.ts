import type { Move } from "chess.js";
import { Chess } from "chess.js";
import { createStockfishClient } from "../../services/engines/stockfish-client.js";
import type {
EngineClient,
RawEngineLine
} from "../../services/engines/types.js";
import type {
ExerciseController,
ExerciseOptions,
ExerciseSnapshot,
ExerciseState,
MateExercise,
MateReply,
MateSolution,
MoveAnalysis
} from "./types.js";
const tokenOf = (move: Move) => move.from + move.to + (move.promotion || "");
const play = (game: Chess, token: string) =>
  game.move({
    from: token.slice(0, 2),
    to: token.slice(2, 4),
    promotion: token[4],
  });
// Calculation only: enumerate every solution to mate in one/two, not just top-1.
export const prepareMateExercise = async (
  move: MoveAnalysis,
  check = () => {},
): Promise<MateExercise | null> => {
  check();
  if (!move.shortMate?.verified || ![1, 2, 3, 4].includes(move.shortMate.moves))
    return null;
  if (move.shortMate.moves >= 3)
    return {
      type: "engine",
      fen: move.fenBefore,
      mateIn: move.shortMate.moves,
    };
  const game = new Chess(move.fenBefore),
    solutions: MateSolution[] = [];
  const yieldTask = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    check();
  };
  for (const first of game.moves({ verbose: true })) {
    await yieldTask();
    game.move(first);
    if (game.isCheckmate()) {
      solutions.push({ move: tokenOf(first), replies: [] });
      game.undo();
      continue;
    }
    if (move.shortMate.moves === 1 || game.isGameOver()) {
      game.undo();
      continue;
    }
    const replies: MateReply[] = [];
    let verified = true;
    for (const reply of game.moves({ verbose: true })) {
      await yieldTask();
      game.move(reply);
      const finishes = [];
      if (!game.isGameOver())
        for (const finish of game.moves({ verbose: true })) {
          game.move(finish);
          if (game.isCheckmate()) finishes.push(tokenOf(finish));
          game.undo();
        }
      game.undo();
      if (!finishes.length) {
        verified = false;
        break;
      }
      replies.push({ move: tokenOf(reply), finishes });
    }
    game.undo();
    if (verified) solutions.push({ move: tokenOf(first), replies });
  }
  return solutions.length
    ? { fen: move.fenBefore, mateIn: move.shortMate.moves, solutions }
    : null;
};
// Playback uses the saved proof tree. Every move waits for an explicit action.
const createSavedMateExercise = (
  exercise: MateExercise,
  options: ExerciseOptions = {},
): ExerciseController => {
  const game = new Chess(exercise.fen);
  let state: ExerciseState = "awaitMove",
    solution: MateSolution | null | undefined = null,
    reply: MateReply | null = null;
  const snapshot = (): ExerciseSnapshot => ({
    fen: game.fen(),
    state,
    mateIn: exercise.mateIn,
    turn: game.turn(),
  });
  return {
    game,
    getSnapshot: snapshot,
    getHint: () => (reply ? reply.finishes[0] : exercise.solutions![0]?.move),
    submit: (token: string) => {
      if (state !== "awaitMove") return snapshot();
      try {
        play(game, token);
      } catch {
        return snapshot();
      }
      const accepted = reply
        ? reply.finishes.includes(token)
        : !!exercise.solutions!.find((row) => row.move === token);
      if (!accepted) {
        state = "wrong";
        return snapshot();
      }
      if (!reply)
        solution = exercise.solutions!.find((row) => row.move === token);
      state = game.isCheckmate() ? "success" : "correct";
      return snapshot();
    },
    continue: () => {
      if (state === "wrong") {
        game.undo();
        state = "awaitMove";
      } else if (state === "correct") {
        reply = [...solution!.replies].sort(
          (a, b) =>
            b.finishes.length - a.finishes.length ||
            a.move.localeCompare(b.move),
        )[0];
        play(game, reply.move);
        state = "opponent";
      } else if (state === "opponent") state = "awaitMove";
      return snapshot();
    },
  };
};

// New positions created by a player's attempt are evaluated only in practice mode.
// Passive review continues to use saved analysis and sends no engine commands.
const createEngineExercise = (
  exercise: MateExercise,
  {
    createClient = createStockfishClient,
    nodes = 300000,
  }: ExerciseOptions = {},
): ExerciseController => {
  const game = new Chess(exercise.fen);
  let state: ExerciseState = "awaitMove",
    client: EngineClient | null = null,
    request = 0,
    reply: string | null = null,
    disposed = false,
    rejectPending: ((reason: Error) => void) | null = null;
  const snapshot = (): ExerciseSnapshot => ({
    fen: game.fen(),
    state,
    mateIn: exercise.mateIn,
    turn: game.turn(),
  });
  const search = () =>
    new Promise<RawEngineLine>((resolve, reject) => {
      client ||= createClient();
      const owned = client,
        id = ++request;
      rejectPending = reject;
      owned.onmessage = ({ data }) => {
        if (disposed || client !== owned || data.id !== id) return;
        rejectPending = null;
        if (data.recovered || !data.lines?.length) {
          reject(Error("Incomplete search"));
          return;
        }
        resolve(data.lines[0]);
      };
      owned.onerror = (error) => {
        rejectPending = null;
        reject(error);
      };
      owned.postMessage({
        id,
        requestId: id,
        jobId: "mate-practice",
        moveIndex: game.history().length,
        fen: game.fen(),
        pgn: game.pgn(),
        analysisOnly: true,
        analysis: { mode: "nodes", nodes, multiPv: 1 },
      });
    });
  return {
    game,
    getSnapshot: snapshot,
    getHint: async () => {
      const line = await search();
      const remaining = exercise.mateIn - Math.floor(game.history().length / 2);
      return !disposed &&
        line.scoreType === "mate" &&
        line.scoreValue > 0 &&
        line.scoreValue <= remaining
        ? line.move
        : null;
    },
    submit: async (token) => {
      if (disposed || state !== "awaitMove") return snapshot();
      try {
        play(game, token);
      } catch {
        return snapshot();
      }
      const remaining = exercise.mateIn - Math.ceil(game.history().length / 2);
      if (game.isCheckmate()) {
        state = "success";
        return snapshot();
      }
      if (game.isGameOver() || remaining <= 0) {
        state = "wrong";
        return snapshot();
      }
      state = "checking";
      try {
        const line = await search();
        if (disposed) return snapshot();
        // Root is now the defending side: a negative mate proves the user's continuation.
        if (line.scoreType !== "mate") state = "unverified";
        else if (line.scoreValue >= 0 || Math.abs(line.scoreValue) > remaining)
          state = "wrong";
        else {
          reply = line.move;
          state = "correct";
        }
      } catch {
        if (!disposed) {
          state = "unverified";
          client?.terminate();
          client = null;
        }
      }
      return snapshot();
    },
    continue: () => {
      if (["wrong", "unverified"].includes(state)) {
        game.undo();
        state = "awaitMove";
      } else if (state === "correct") {
        try {
          play(game, reply!);
          state = "opponent";
        } catch {
          game.undo();
          state = "awaitMove";
        }
      } else if (state === "opponent") state = "awaitMove";
      return snapshot();
    },
    dispose: () => {
      disposed = true;
      request++;
      client?.terminate();
      client = null;
      rejectPending?.(new DOMException("Cancelled", "AbortError"));
      rejectPending = null;
    },
  };
};

// Count only checked legal failures, by position. Unverified searches never cost an attempt.
const withAttempts = (
  exercise: ExerciseController,
  { attempts = new Map<string, number>() }: ExerciseOptions = {},
): ExerciseController => {
  let hintPending = false;
  const position = () => {
    const game = exercise.game;
    return game.fen().split(" ").slice(0, 4).join(" ");
  };
  const snapshot = (): ExerciseSnapshot => ({
    ...exercise.getSnapshot(),
    hintPending,
    failedAttempts: attempts.get(position()) || 0,
    canHint: (attempts.get(position()) || 0) >= 5,
  });
  return {
    ...exercise,
    getSnapshot: snapshot,
    submit: (token: string) => {
      if (hintPending || exercise.getSnapshot().state !== "awaitMove")
        return snapshot();
      const key = position(),
        before = exercise.game.history().length;
      const finish = () => {
        if (
          exercise.game.history().length > before &&
          exercise.getSnapshot().state === "wrong"
        )
          attempts.set(key, (attempts.get(key) || 0) + 1);
        return snapshot();
      };
      const result = exercise.submit(token);
      return result instanceof Promise ? result.then(finish) : finish();
    },
    getHint: async () => {
      if (
        hintPending ||
        exercise.getSnapshot().state !== "awaitMove" ||
        !snapshot().canHint
      )
        return null;
      hintPending = true;
      try {
        return await exercise.getHint();
      } catch {
        return null;
      } finally {
        hintPending = false;
      }
    },
  };
};
export const createEngineMateExercise = (
  exercise: MateExercise,
  options: ExerciseOptions = {},
) => withAttempts(createEngineExercise(exercise, options), options);
export const createMateExercise = (
  exercise: MateExercise,
  options: ExerciseOptions = {},
) =>
  exercise.type === "engine"
    ? createEngineMateExercise(exercise, options)
    : withAttempts(createSavedMateExercise(exercise, options), options);
