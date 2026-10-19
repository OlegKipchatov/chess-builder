import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { Chess } from "chess.js";
import { VaultProvider } from "../../src/app/providers/VaultProvider";
import { OverlayProvider } from "../../src/app/providers/OverlayProvider";
import { initialState, KEY } from "../../src/services/persistence/state";
import { createVaultStore } from "../../src/services/persistence/vault-store";
import { completedMatch } from "../../src/domain/chess/archive";
import { createStartedGame } from "../../src/domain/chess/session";
import {
  ANALYSIS_VERSION,
  ENGINE,
  PROFILE,
} from "../../src/domain/analysis/analysis-config";
import type {
  GameAnalysis,
  MateExercise,
} from "../../src/domain/analysis/types";
import { GameReview } from "../../src/features/game-review/GameReview";
import { MatePractice } from "../../src/features/game-review/MatePractice";
import { useGameAnalysis } from "../../src/features/game-review/useGameAnalysis";
import { prepareMateExercise } from "../../src/services/analysis/analysis-training";
import { analyzeGame } from "../../src/services/analysis/analysis-service";
vi.mock("../../src/services/analysis/analysis-service", () => ({
  analyzeGame: vi.fn(),
}));
const fixture = () => {
  const state = initialState(),
    game = new Chess();
  game.loadPgn("1. e4 e5 2. Nf3");
  state.game = { ...createStartedGame(state, () => 0), resigned: true };
  const entry = completedMatch(state, game, {
    id: "review",
    finishedAt: "2026-10-16T12:00:00Z",
  })!.entry!;
  const analysis: GameAnalysis = {
    analysisVersion: ANALYSIS_VERSION,
    profileVersion: PROFILE.version,
    engine: ENGINE,
    gameId: entry.id,
    sourcePgn: entry.pgn,
    playerColor: "w",
    createdAt: "2026-10-16",
    status: "complete",
    totalPlies: 3,
    analyzedPlayerMoves: 2,
    focusEvents: [3],
    summary: {
      best: 1,
      good: 0,
      inaccuracy: 0,
      mistake: 1,
      blunder: 0,
      excellent: 0,
    },
    moves: game.history({ verbose: true }).map((move, i) => ({
      ply: i + 1,
      actor: i % 2 ? "opponent" : "player",
      fenBefore: move.before,
      fenAfter: move.after,
      playedMove: move.from + move.to,
      playedSan: move.san,
      status: "complete",
      quality: i === 2 ? "mistake" : "best",
      expectedScoreLoss: i === 2 ? 0.1 : 0,
      alternatives: [],
      autoPause: i === 2,
      ...(i === 2
        ? {
            bestLine: {
              move: "d2d4",
              san: "d4",
              pv: ["d2d4", "e5d4"],
              pvSan: ["d4", "exd4"],
              score: { type: "cp", value: 30 },
              expectedScorePlayer: 0.55,
            },
          }
        : {}),
    })),
  };
  entry.analysis = analysis;
  return { state, entry, analysis };
};
const setup = (state = initialState()) => {
  localStorage.setItem(KEY, JSON.stringify(state));
  const store = createVaultStore(localStorage);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <VaultProvider store={store}>
      <OverlayProvider>{children}</OverlayProvider>
    </VaultProvider>
  );
  return { store, wrapper };
};
describe("React review and practice parity", () => {
  it("restores the opponent label and material balance while replaying captures", async () => {
    const { entry } = fixture(),
      { wrapper } = setup();
    entry.pgn = "1. e4 d5 2. exd5";
    delete entry.analysis;
    const view = render(<GameReview entry={entry} />, { wrapper });
    expect(view.container.querySelector(".match-versus")).toHaveTextContent(
      "ИИ",
    );
    expect(view.container.querySelector("#match-points")).toHaveTextContent(
      "0 очков",
    );
    fireEvent.change(screen.getByRole("slider"), { target: { value: "3" } });
    await act(async () => {});
    expect(view.container.querySelector("#match-points")).toHaveTextContent(
      "+1 очков",
    );
    expect(view.container.querySelector("#match-points")).toHaveAttribute(
      "data-balance",
      "positive",
    );
  });
  it("reuses compatible saved analysis without an engine; incompatible cache never masquerades as ready", () => {
    const { entry, analysis } = fixture(),
      { wrapper } = setup();
    const view = renderHook(({ entry }) => useGameAnalysis(entry), {
      wrapper,
      initialProps: { entry },
    });
    expect(view.result.current.analysis).toBe(analysis);
    expect(analyzeGame).not.toHaveBeenCalled();
    view.unmount();
    const stale = {
      ...entry,
      analysis: { ...analysis, analysisVersion: "post-game-analysis-v3" },
    };
    const invalid = renderHook(() => useGameAnalysis(stale), { wrapper });
    expect(invalid.result.current.job.status).toBe("idle");
    expect(invalid.result.current.analysis).toBeUndefined();
    expect(analyzeGame).not.toHaveBeenCalled();
  });
  it("hint starts before the proposed move, expanded playback points to the next move and keeps controls by the board", async () => {
    const { entry } = fixture(),
      { wrapper } = setup();
    const view = render(<GameReview entry={entry} />, { wrapper });
    expect(screen.queryByText("Разобрать партию")).toBeNull();
    expect(view.container.querySelector(".analysis-active")).toBeTruthy();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "3" } });
    await act(async () => {});
    fireEvent.click(screen.getByText("Подсказка"));
    expect(view.container.querySelector('[data-square="d2"]')).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Пешка"),
    );
    expect(view.container.querySelector('[data-square="d4"]')).toHaveAttribute(
      "aria-label",
      expect.stringContaining("пусто"),
    );
    expect(
      view.container.querySelector('svg[aria-label="Рекомендуемый ход"] line'),
    ).toHaveAttribute("y1", "6.5");
    fireEvent.click(screen.getByText("Вариант"));
    expect(screen.getByRole("slider")).toHaveValue("0");
    expect(screen.getByRole("slider").closest(".board-area")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Следующая позиция"));
    expect(view.container.querySelector('[data-square="d4"]')).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Пешка"),
    );
    expect(
      view.container.querySelector('svg[aria-label="Рекомендуемый ход"] line'),
    ).toHaveAttribute("y1", "3.5");
    fireEvent.click(screen.getByLabelText("Следующая позиция"));
    expect(
      view.container.querySelector('svg[aria-label="Рекомендуемый ход"]'),
    ).toBeNull();
    expect(
      screen.queryByLabelText("Начать воспроизведение"),
    ).not.toBeInTheDocument();
    const returnButton = screen.getByRole("button", {
      name: "Вернуться к партии",
    });
    expect(returnButton.closest(".history-buttons")).toBeTruthy();
    expect(returnButton.closest(".history-controls")).toContainElement(
      screen.getByRole("slider"),
    );
    fireEvent.click(returnButton);
    expect(screen.getByRole("slider")).toHaveValue("3");
    expect(view.container.querySelector("#match-surface")).toHaveAttribute(
      "data-mode",
      "review",
    );
    expect(view.container.querySelector('[data-square="f3"]')).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Конь"),
    );
    expect(screen.getByRole("button", { name: "Подсказка" })).toHaveFocus();
    expect(
      screen.queryByRole("button", { name: "Вернуться к партии" }),
    ).toBeNull();
    expect(analyzeGame).not.toHaveBeenCalled();
  });
  it("cancels a running analysis and ignores a late result after leaving", async () => {
    const { entry, analysis } = fixture();
    delete entry.analysis;
    let finish!: (value: GameAnalysis) => void;
    vi.mocked(analyzeGame).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { wrapper, store } = setup();
    const view = renderHook(() => useGameAnalysis(entry), { wrapper });
    let pending!: Promise<void>;
    act(() => {
      pending = view.result.current.start();
    });
    const signal = vi.mocked(analyzeGame).mock.calls.at(-1)![1]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      finish(analysis);
      await pending;
    });
    expect(store.getSnapshot().archive).toHaveLength(0);
  });
  it("mate in two automatically responds after each 420ms animation, without extra Continue clicks", async () => {
    const board = new Chess();
    board.loadPgn(
      "1. Nc3 c6 2. Nf3 d5 3. d4 f6 4. Nxd5 cxd5 5. a4 e5 6. Nxe5 fxe5 7. Bf4 exf4 8. Kd2 g5 9. h4 Bg7 10. Rh3 Bxd4 11. Rh2 Bxb2 12. Ra2 Qb6 13. hxg5 h6 14. Rh4 Qb4+ 15. c3 Qxc3#",
    );
    const exercise = await prepareMateExercise({
      fenBefore: board.history({ verbose: true })[25].before,
      shortMate: { verified: true, moves: 2 },
    } as Parameters<typeof prepareMateExercise>[0]);
    expect(exercise).not.toBeNull();
    const { wrapper } = setup();
    vi.useFakeTimers();
    const view = render(
      <MatePractice
        exercise={exercise!}
        equipped={initialState().equipped}
        attempts={new Map()}
        onClose={() => {}}
      />,
      { wrapper },
    );
    fireEvent.click(view.container.querySelector('[data-square="b6"]')!);
    await act(async () =>
      fireEvent.click(view.container.querySelector('[data-square="b4"]')!),
    );
    expect(screen.getByText("Верно")).toHaveAttribute("role", "status");
    expect(screen.queryByText("Продолжить")).toBeNull();
    act(() => vi.advanceTimersByTime(420));
    expect(screen.getByRole("heading", { name: "Мат в 1" })).toBeVisible();
    expect(screen.getByText("Ход соперника")).toHaveAttribute("role", "status");
    act(() => vi.advanceTimersByTime(420));
    expect(screen.getByText("Найдите продолжение")).toHaveAttribute(
      "role",
      "status",
    );
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("shows the no-serious-errors result only for a completed analysis at the end", async () => {
    const { entry, analysis } = fixture(),
      { wrapper } = setup();
    analysis.moves.forEach((move) => {
      move.quality = "good";
      move.expectedScoreLoss = 0;
    });
    const view = render(<GameReview entry={entry} />, { wrapper });
    expect(screen.queryByText("Серьёзных ошибок не найдено.")).toBeNull();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "3" } });
    await act(async () => {});
    expect(screen.getByText("Серьёзных ошибок не найдено.")).toBeVisible();
    view.unmount();
  });
  it("shows a retryable hint failure without closing practice", async () => {
    const exercise: MateExercise = {
      fen: "7k/8/5K2/8/8/8/8/3Q4 w - - 0 1",
      mateIn: 1,
      solutions: [],
    };
    const attempts = new Map([
        [exercise.fen.split(" ").slice(0, 4).join(" "), 5],
      ]),
      { wrapper } = setup();
    render(
      <MatePractice
        exercise={exercise}
        equipped={initialState().equipped}
        attempts={attempts}
        onClose={() => {}}
      />,
      { wrapper },
    );
    await act(async () => fireEvent.click(screen.getByText("Подсказка")));
    expect(
      screen.getByText("Не удалось получить подсказку. Попробуйте ещё раз."),
    ).toHaveAttribute("role", "alert");
    expect(screen.getByText("Подсказка")).toBeEnabled();
  });
  it("does not expose a raw engine exception in the interface", async () => {
    const { entry } = fixture();
    delete entry.analysis;
    vi.mocked(analyzeGame).mockRejectedValueOnce(
      new Error("Incomplete MultiPV secret diagnostic"),
    );
    const { wrapper } = setup();
    const view = renderHook(() => useGameAnalysis(entry), { wrapper });
    await act(async () => view.result.current.start());
    expect(view.result.current.job).toEqual({
      status: "failed",
      message: "Не удалось завершить анализ. Попробуйте ещё раз.",
    });
  });
  it("five wrong attempts survive exit and re-entry before a hint is requested", async () => {
    const exercise: MateExercise = {
        fen: "7k/8/5K2/8/8/8/8/3Q4 w - - 0 1",
        mateIn: 1,
        solutions: [{ move: "d1g4", replies: [] }],
      },
      attempts = new Map<string, number>(),
      { wrapper } = setup(),
      props = {
        exercise,
        equipped: initialState().equipped,
        attempts,
        onClose: () => {},
      };
    let view = render(<MatePractice {...props} />, { wrapper });
    for (let n = 0; n < 5; n++) {
      fireEvent.click(view.container.querySelector('[data-square="d1"]')!);
      await act(async () =>
        fireEvent.click(view.container.querySelector('[data-square="d2"]')!),
      );
      fireEvent.click(screen.getByText("Продолжить"));
    }
    expect(screen.getByText("Подсказка")).toBeVisible();
    view.unmount();
    view = render(<MatePractice {...props} />, { wrapper });
    expect(screen.getByText("Подсказка")).toBeVisible();
    expect(
      view.container.querySelector('svg[aria-label="Рекомендуемый ход"]'),
    ).toBeNull();
    await act(async () => fireEvent.click(screen.getByText("Подсказка")));
    expect(
      view.container.querySelector('svg[aria-label="Рекомендуемый ход"]'),
    ).toBeTruthy();
  });
});
