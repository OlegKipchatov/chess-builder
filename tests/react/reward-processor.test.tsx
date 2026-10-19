import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RewardProcessor } from "../../src/features/game-session/RewardProcessor";
import { VaultProvider } from "../../src/app/providers/VaultProvider";
import { createVaultStore } from "../../src/services/persistence/vault-store";
import {
  initialState,
  migrateState,
} from "../../src/services/persistence/state";
import { summarizeQuality } from "../../src/domain/economy/reward-quality";
import fixture from "../fixtures/persistence/v3-active-game.json";
import { analyzeReward } from "../../src/services/engines/economy-analysis";
vi.mock("../../src/services/engines/economy-analysis", () => ({
  analyzeReward: vi.fn(),
}));
const quality = summarizeQuality([{ loss: 0 }]);
const setup = () => {
  const state = initialState();
  const entry = migrateState(
    fixture.input as Parameters<typeof migrateState>[0],
  ).archive[0];
  state.archive = [
    {
      ...entry,
      rewardBreakdown: {
        cleanMoves: 1,
        completion: 5,
        moves: 0,
        result: 5,
        outcome: "loss",
        reason: null,
        quality: 0,
        qualityStatus: "pending",
        rewardVersion: "game-economy-v2",
        total: 10,
      },
    },
  ];
  let raw = JSON.stringify(state),
    blocked = false;
  const store = createVaultStore({
    getItem: () => raw,
    setItem: (_, value) => {
      if (blocked) throw Error("quota");
      raw = value;
    },
  });
  blocked = true;
  const view = render(
    <VaultProvider store={store}>
      <RewardProcessor />
    </VaultProvider>,
  );
  return {
    store,
    view,
    recover: () => {
      blocked = false;
    },
  };
};
describe("quality reward persistence", () => {
  beforeEach(() => {
    vi.mocked(analyzeReward).mockReset();
  });
  it("retries the cached exact bonus without rerunning analysis or double credit", async () => {
    vi.mocked(analyzeReward).mockResolvedValue(quality);
    const { store, recover } = setup();
    const retry = await screen.findByRole("button", {
      name: "Повторить сохранение бонуса",
    });
    expect(store.getSnapshot().coins).toBe(100);
    recover();
    fireEvent.click(retry);
    await waitFor(() =>
      expect(store.getSnapshot().coins).toBe(100 + quality.total),
    );
    expect(analyzeReward).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await act(async () => store.refresh());
    expect(store.getSnapshot().coins).toBe(100 + quality.total);
  });
  it("preserves fallback and diagnostics when engine evaluation fails", async () => {
    const diagnostics = [
      { ply: 1, stage: "best", attempt: 3, message: "timeout" },
    ];
    vi.mocked(analyzeReward).mockImplementation(async () => {
      throw Object.assign(Error("engine"), { diagnostics });
    });
    const { store, recover } = setup();
    const retry = await screen.findByRole("button", {
      name: "Повторить сохранение бонуса",
    });
    recover();
    fireEvent.click(retry);
    await waitFor(() => expect(store.getSnapshot().coins).toBe(105));
    expect(store.getSnapshot().archive[0].rewardBreakdown).toMatchObject({
      qualityStatus: "fallback",
      qualityDiagnostics: diagnostics,
    });
    expect(analyzeReward).toHaveBeenCalledTimes(1);
  });
  it("does not save a late analysis result after unmount", async () => {
    let finish!: (value: typeof quality) => void;
    vi.mocked(analyzeReward).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { store, recover, view } = setup();
    recover();
    view.unmount();
    await act(async () => finish(quality));
    expect(store.getSnapshot().coins).toBe(100);
  });
});
