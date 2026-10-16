import { StrictMode, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { VaultProvider } from "../../src/app/providers/VaultProvider";
import { OverlayProvider } from "../../src/app/providers/OverlayProvider";
import { createVaultStore } from "../../src/services/persistence/vault-store";
import { initialState, KEY } from "../../src/services/persistence/state";
import { useGameSession } from "../../src/features/game-session/useGameSession";
import { createStartedGame } from "../../src/domain/chess/session";
import type {
  EngineClient,
  EngineRequest,
} from "../../src/shared/types/engine";
const engines = vi.hoisted(() => ({
  clients: [] as (EngineClient & {
    requests: EngineRequest[];
    stopped: boolean;
  })[],
}));
vi.mock("../../src/services/engines/bot-client", () => ({
  createBotClient: () => {
    const client = {
      onmessage: null,
      onerror: null,
      requests: [] as EngineRequest[],
      stopped: false,
      postMessage(data: EngineRequest) {
        this.requests.push(data);
      },
      terminate() {
        this.stopped = true;
      },
    };
    engines.clients.push(client);
    return client;
  },
}));
const setup = (state = initialState()) => {
  engines.clients = [];
  localStorage.setItem(KEY, JSON.stringify(state));
  const store = createVaultStore(localStorage),
    wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>
        <VaultProvider store={store}>
          <OverlayProvider>{children}</OverlayProvider>
        </VaultProvider>
      </StrictMode>
    );
  return { store, ...renderHook(useGameSession, { wrapper }) };
};
describe("game session lifecycle", () => {
  it("restores both sides of a legacy local game", async () => {
    vi.useFakeTimers();
    const state = initialState();
    state.game = { ...state.game, mode: "local", started: true, pgn: "1. e4" };
    const { result, store, unmount } = setup(state);
    await act(async () => {
      await result.current.move("e7", "e5");
    });
    expect(result.current.game.history()).toEqual(["e4", "e5"]);
    expect(store.getSnapshot().game.mode).toBe("local");
    expect(engines.clients).toHaveLength(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("recovers a corrupt active PGN without resetting the wallet or collection", async () => {
    const state = initialState();
    state.coins = 453;
    state.shards = 42;
    state.game = { ...state.game, started: true, pgn: "not a chess game" };
    const { result, store } = setup(state);
    await waitFor(() => expect(result.current.saved.started).toBe(false));
    expect(store.getSnapshot().coins).toBe(453);
    expect(store.getSnapshot().shards).toBe(42);
    expect(result.current.game.history()).toEqual([]);
  });
  it("fences retired Strict Mode engines and cleans all timers", async () => {
    vi.useFakeTimers();
    const state = initialState();
    state.game = createStartedGame(state, () => 0.7);
    const { result, store, unmount } = setup(state);
    const retired = engines.clients.find((c) => c.stopped),
      live = engines.clients.find((c) => !c.stopped);
    expect(live).toBeDefined();
    expect(engines.clients.filter((c) => !c.stopped)).toHaveLength(1);
    const request = live!.requests[0];
    expect(request).toBeDefined();
    await act(async () => {
      await retired?.onmessage?.({
        data: { id: request.id, move: { from: "e2", to: "e4" } },
      });
    });
    expect(store.getSnapshot().game.pgn).toBe("");
    await act(async () => {
      await live!.onmessage?.({
        data: { id: request.id, move: { from: "e2", to: "e4" } },
      });
    });
    expect(result.current.game.history()).toEqual(["e4"]);
    unmount();
    expect(engines.clients.every((c) => c.stopped)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
