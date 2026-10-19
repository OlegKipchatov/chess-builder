import { StrictMode, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { VaultProvider } from "../../src/app/providers/VaultProvider";
import { OverlayProvider } from "../../src/app/providers/OverlayProvider";
import { useLiveRewardAnalysis } from "../../src/features/game-session/useLiveRewardAnalysis";
import { useGameSession } from "../../src/features/game-session/useGameSession";
import { createVaultStore } from "../../src/services/persistence/vault-store";
import { initialState, KEY } from "../../src/services/persistence/state";
import { createStartedGame } from "../../src/domain/chess/session";
import { analyzeReward } from "../../src/services/engines/economy-analysis";
import { ECONOMY_PROFILE } from "../../src/domain/economy/reward-quality";
import type { RewardCheckpoint } from "../../src/domain/economy/types";

vi.mock("../../src/services/engines/economy-analysis", () => ({
  analyzeReward: vi.fn(),
}));
const bot = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("../../src/services/engines/bot-client", () => ({
  createBotClient: () => ({
    postMessage: bot.search,
    terminate: () => {},
    onmessage: null,
    onerror: null,
  }),
}));
const setup = () => {
  const state = initialState();
  state.game = {
    ...createStartedGame(state, () => 0),
    playerColor: "w",
    pgn: "1. e4 e5",
  };
  localStorage.setItem(KEY, JSON.stringify(state));
  const store = createVaultStore(localStorage);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <VaultProvider store={store}>
        <OverlayProvider>{children}</OverlayProvider>
      </VaultProvider>
    </StrictMode>
  );
  return { store, wrapper };
};
const checkpoint: RewardCheckpoint = {
  profile: ECONOMY_PROFILE.version,
  playerColor: "w",
  initialFen: new Chess().fen(),
  moves: ["e2e4"],
  decisions: [{ loss: 0 }],
};
const options = () => vi.mocked(analyzeReward).mock.calls.at(-1)![1]!;

describe("live reward lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(analyzeReward)
      .mockReset()
      .mockImplementation(() => new Promise(() => {}));
    bot.search.mockReset();
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  });
  it("saves progress without awarding coins, pauses when hidden, resumes from storage and fences late writes", async () => {
    const { store, wrapper } = setup();
    const initial = store.getSnapshot().game;
    const view = renderHook(
      () => useLiveRewardAnalysis(true, initial.pgn, initial.startedAt),
      { wrapper },
    );
    await act(async () => vi.advanceTimersByTimeAsync(200));
    expect(analyzeReward).toHaveBeenCalledTimes(1);
    const first = options();
    await act(async () => first.onCheckpoint!(checkpoint));
    expect(store.getSnapshot().game.rewardCheckpoint).toEqual(checkpoint);
    expect(store.getSnapshot().coins).toBe(100);
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(first.signal!.aborted).toBe(true);
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => vi.advanceTimersByTimeAsync(200));
    expect(
      vi.mocked(analyzeReward).mock.calls.at(-1)![0].rewardCheckpoint,
    ).toEqual(checkpoint);
    const second = options();
    await act(async () =>
      store.update((state) => ({
        ...state,
        game: {
          ...state.game,
          startedAt: "another-game",
          rewardCheckpoint: undefined,
        },
      })),
    );
    expect(second.signal!.aborted).toBe(true);
    await act(async () => second.onCheckpoint!(checkpoint));
    expect(store.getSnapshot().game.rewardCheckpoint).toBeUndefined();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not schedule while blocked and cancels a pending start immediately", async () => {
    const { store, wrapper } = setup();
    const game = store.getSnapshot().game;
    const view = renderHook(
      ({ enabled }) => useLiveRewardAnalysis(enabled, game.pgn, game.startedAt),
      { wrapper, initialProps: { enabled: false } },
    );
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(analyzeReward).not.toHaveBeenCalled();
    view.rerender({ enabled: true });
    act(() => view.result.current());
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(analyzeReward).not.toHaveBeenCalled();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("stops analysis before the opponent search and restarts no work during animation", async () => {
    const { wrapper } = setup();
    const view = renderHook(useGameSession, { wrapper });
    await act(async () => vi.advanceTimersByTimeAsync(200));
    expect(analyzeReward).toHaveBeenCalledTimes(1);
    const signal = options().signal!;
    bot.search.mockImplementation(() => expect(signal.aborted).toBe(true));
    await act(async () => view.result.current.move("g1", "f3"));
    expect(signal.aborted).toBe(true);
    expect(bot.search).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(bot.search).toHaveBeenCalledTimes(1);
    expect(analyzeReward).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("unmount cancels a running analysis without accepting late progress", async () => {
    const { store, wrapper } = setup();
    const game = store.getSnapshot().game;
    const view = renderHook(
      () => useLiveRewardAnalysis(true, game.pgn, game.startedAt),
      { wrapper },
    );
    await act(async () => vi.advanceTimersByTimeAsync(200));
    const running = options();
    view.unmount();
    expect(running.signal!.aborted).toBe(true);
    await running.onCheckpoint!(checkpoint);
    expect(store.getSnapshot().game.rewardCheckpoint).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
});
