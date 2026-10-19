import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { Chess } from "chess.js";
import { VaultProvider } from "../../src/app/providers/VaultProvider";
import { OverlayProvider } from "../../src/app/providers/OverlayProvider";
import {
  ImportedGameProvider,
  useImportedGame,
} from "../../src/features/game-review/ImportedGameProvider";
import { PgnImport } from "../../src/features/game-review/PgnImport";
import { analyzeGame } from "../../src/services/analysis/analysis-service";
import { initialState, KEY } from "../../src/services/persistence/state";
import { createVaultStore } from "../../src/services/persistence/vault-store";
import {
  ANALYSIS_VERSION,
  ENGINE,
  PROFILE,
} from "../../src/domain/analysis/analysis-config";
import type { ArchiveEntry } from "../../src/domain/chess/types";
import type { GameAnalysis } from "../../src/domain/analysis/types";

vi.mock("../../src/services/analysis/analysis-service", () => ({
  analyzeGame: vi.fn(),
}));
vi.mock("../../src/features/game-review/PgnImportDialog", () => ({
  usePgnImportDialog: () => () => {},
}));

const imported = (id = "first", pgn = "1. e4 e5 2. Nf3 Nc6"): ArchiveEntry => ({
  id,
  pgn,
  imported: true,
  counted: false,
  mode: "local",
  playerColor: "w",
  finishedAt: "",
  result: "*",
  equipped: initialState().equipped,
  points: 0,
  playerRating: 0,
  opponentRating: null,
  ratingDelta: null,
  engineProfile: null,
});
const resultFor = (entry: ArchiveEntry): GameAnalysis => {
  const game = new Chess();
  game.loadPgn(entry.pgn);
  const moves = game.history({ verbose: true });
  return {
    analysisVersion: ANALYSIS_VERSION,
    profileVersion: PROFILE.version,
    engine: ENGINE,
    gameId: entry.id,
    sourcePgn: entry.pgn,
    playerColor: entry.playerColor,
    createdAt: "2026-10-19",
    status: "complete",
    totalPlies: moves.length,
    analyzedPlayerMoves: moves.filter(
      (move) => move.color === entry.playerColor,
    ).length,
    focusEvents: [],
    summary: {
      best: 2,
      good: 0,
      inaccuracy: 0,
      mistake: 0,
      blunder: 0,
      excellent: 0,
    },
    moves: moves.map((move, index) => ({
      ply: index + 1,
      actor: move.color === entry.playerColor ? "player" : "opponent",
      fenBefore: move.before,
      fenAfter: move.after,
      playedMove: move.from + move.to,
      playedSan: move.san,
      status: move.color === entry.playerColor ? "complete" : "not_analyzed",
      quality: "best",
      alternatives: [],
      autoPause: false,
    })),
  };
};
const Harness = ({ entry }: { entry: ArchiveEntry }) => {
  const { setEntry } = useImportedGame();
  return (
    <>
      <button onClick={() => setEntry(entry)}>Загрузить тестовый PGN</button>
      <PgnImport />
    </>
  );
};
const setup = (entry = imported()) => {
  localStorage.setItem(KEY, JSON.stringify(initialState()));
  const store = createVaultStore(localStorage),
    update = vi.spyOn(store, "update"),
    before = localStorage.getItem(KEY);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <VaultProvider store={store}>
      <OverlayProvider>
        <ImportedGameProvider>{children}</ImportedGameProvider>
      </OverlayProvider>
    </VaultProvider>
  );
  const view = render(<Harness entry={entry} />, { wrapper });
  fireEvent.click(screen.getByText("Загрузить тестовый PGN"));
  return { ...view, store, update, before };
};

describe("imported PGN analysis", () => {
  it("analyzes either side, reuses both session results and never writes personal progress", async () => {
    vi.mocked(analyzeGame).mockImplementation(async (entry) =>
      resultFor(entry),
    );
    const view = setup();
    fireEvent.click(screen.getByRole("button", { name: "Разобрать партию" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Разобрать партию" }),
      ).toBeNull(),
    );
    expect(analyzeGame).toHaveBeenLastCalledWith(
      expect.objectContaining({ imported: true, playerColor: "w" }),
      expect.anything(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Чёрные" }));
    expect(screen.getByRole("button", { name: "Чёрные" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Разобрать партию" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Разобрать партию" }),
      ).toBeNull(),
    );
    expect(analyzeGame).toHaveBeenLastCalledWith(
      expect.objectContaining({ playerColor: "b" }),
      expect.anything(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Белые" }));
    expect(
      screen.queryByRole("button", { name: "Разобрать партию" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Чёрные" }));
    expect(
      screen.queryByRole("button", { name: "Разобрать партию" }),
    ).toBeNull();
    expect(analyzeGame).toHaveBeenCalledTimes(2);
    view.rerender(<Harness entry={imported("second", "1. d4 d5")} />);
    fireEvent.click(screen.getByText("Загрузить тестовый PGN"));
    expect(
      screen.getByRole("button", { name: "Разобрать партию" }),
    ).toBeVisible();
    expect(view.update).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe(view.before);
    expect(view.store.getSnapshot().archive).toHaveLength(0);
  });

  it("cancels on side changes, replacement and exit; late results never become another game's analysis", async () => {
    let finish!: (result: GameAnalysis) => void;
    vi.mocked(analyzeGame).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = imported(),
      view = setup(first);
    fireEvent.click(screen.getByRole("button", { name: "Разобрать партию" }));
    const firstSignal = vi.mocked(analyzeGame).mock.calls.at(-1)![1]!.signal!;
    fireEvent.click(screen.getByRole("button", { name: "Чёрные" }));
    expect(firstSignal.aborted).toBe(true);
    await act(async () => finish(resultFor(first)));
    fireEvent.click(screen.getByRole("button", { name: "Белые" }));
    expect(
      screen.getByRole("button", { name: "Разобрать партию" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Разобрать партию" }));
    const replacedSignal = vi.mocked(analyzeGame).mock.calls.at(-1)![1]!
      .signal!;
    const second = imported("second", "1. d4 d5");
    view.rerender(<Harness entry={second} />);
    fireEvent.click(screen.getByText("Загрузить тестовый PGN"));
    expect(replacedSignal.aborted).toBe(true);
    await act(async () => finish(resultFor(first)));
    expect(
      screen.getByRole("button", { name: "Разобрать партию" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Разобрать партию" }));
    const exitSignal = vi.mocked(analyzeGame).mock.calls.at(-1)![1]!.signal!;
    view.unmount();
    expect(exitSignal.aborted).toBe(true);
    await act(async () => finish(resultFor(second)));
    expect(view.update).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe(view.before);
  });

  it("does not offer a side with no recorded decisions", () => {
    const view = setup(imported("short", "1. e4"));
    expect(screen.getByRole("button", { name: "Белые" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Чёрные" })).toBeDisabled();
    expect(view.update).not.toHaveBeenCalled();
  });
});
