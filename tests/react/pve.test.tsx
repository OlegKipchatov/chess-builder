import { OverlayProvider } from "../../src/app/providers/OverlayProvider";
import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { VaultProvider } from "../../src/app/providers/VaultProvider";
import { initialState, KEY } from "../../src/services/persistence/state";
import { createVaultStore } from "../../src/services/persistence/vault-store";
import { beginPveBattle } from "../../src/domain/pve/pve-battle";
import { usePveBattle } from "../../src/features/pve/usePveBattle";
const workers: FakeWorker[] = [];
class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    workers.push(this);
  }
}
const setup = async ({
  killed = false,
  reduced = false,
  black = false,
  ep = false,
} = {}) => {
  workers.length = 0;
  vi.useFakeTimers();
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("matchMedia", () => ({
    matches: reduced,
    addEventListener() {},
    removeEventListener() {},
  }));
  const state = initialState();
  state.pve = beginPveBattle(state.pve, "trail", () => 0);
  const battle = state.pve.battle!,
    pawn = battle.units.find((u) => u.type === "p" && u.color === "w")!,
    victim = battle.units.find((u) => u.type === "p" && u.color === "b")!;
  battle.units.forEach((unit) => {
    if (unit.type === "k") {
      unit.square = unit.color === "w" ? "a1" : "h8";
    } else unit.hp = 0;
  });
  pawn.square = ep ? "e5" : "c4";
  pawn.hp = 100;
  victim.square = ep ? "d5" : "d5";
  victim.type = ep ? "p" : "n";
  victim.hp = killed ? 1 : 120;
  battle.turn = black ? "b" : "w";
  if (ep)
    battle.lastEvent = {
      from: "d7",
      to: "d5",
      attackerId: victim.id,
      targetId: null,
      targetSquare: null,
      enPassant: false,
      damage: 0,
      killed: false,
      moved: true,
      promoted: false,
    };
  localStorage.setItem(KEY, JSON.stringify(state));
  const store = createVaultStore(localStorage),
    wrapper = ({ children }: { children: ReactNode }) => (
      <VaultProvider store={store}>
        <OverlayProvider>{children}</OverlayProvider>
      </VaultProvider>
    );
  const view = renderHook(({ active }) => usePveBattle(active), {
    wrapper,
    initialProps: { active: true },
  });
  await act(async () => {});
  return { ...view, store, pawn, victim };
};
describe("PvE React orchestration and combat timing", () => {
  for (const killed of [false, true])
    it(`commits once, then approach → damage → ${killed ? "finish" : "return"} with 420ms phases`, async () => {
      const view = await setup({ killed });
      const before = view.result.current.visual!;
      await act(() => view.result.current.move({ from: "c4", to: "d5" }));
      expect(view.store.getSnapshot().pve.battle!.ply).toBe(1);
      expect(view.result.current.phase).toBe("animating");
      expect(view.result.current.attack).toEqual({
        id: view.pawn.id,
        to: "d5",
      });
      expect(
        view.result.current.visual!.units.find((u) => u.id === view.victim.id)
          ?.hp,
      ).toBe(before.units.find((u) => u.id === view.victim.id)?.hp);
      act(() => vi.advanceTimersByTime(419));
      expect(view.result.current.attack?.damage).toBeUndefined();
      act(() => vi.advanceTimersByTime(1));
      expect(view.result.current.attack).toMatchObject({
        targetId: view.victim.id,
        damage: killed ? 1 : 80,
      });
      expect(
        view.result.current.visual!.units.find((u) => u.id === view.victim.id)
          ?.hp,
      ).toBe(killed ? 0 : 40);
      act(() => vi.advanceTimersByTime(420));
      if (!killed) {
        expect(view.result.current.phase).toBe("animating");
        expect(view.result.current.attack).toBeUndefined();
        act(() => vi.advanceTimersByTime(420));
      }
      expect(view.result.current.phase).toBe("thinking");
      expect(
        view.result.current.visual!.units.find((u) => u.id === view.pawn.id)
          ?.square,
      ).toBe(killed ? "d5" : "c4");
      expect(view.store.getSnapshot().pve.battle!.ply).toBe(1);
      view.unmount();
      expect(vi.getTimerCount()).toBe(0);
    });
  it("unmount before contact cancels presentation and cannot apply a late visual impact", async () => {
    const view = await setup();
    await act(() => view.result.current.move({ from: "c4", to: "d5" }));
    const snapshot = view.result.current.visual;
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(2000));
    expect(view.result.current.visual).toBe(snapshot);
    expect(view.store.getSnapshot().pve.battle!.ply).toBe(1);
  });
  it("reduced motion applies committed damage immediately without a presentation delay", async () => {
    const view = await setup({ reduced: true });
    await act(() => view.result.current.move({ from: "c4", to: "d5" }));
    expect(
      view.result.current.visual!.units.find((u) => u.id === view.victim.id)
        ?.hp,
    ).toBe(40);
    expect(view.result.current.phase).toBe("thinking");
    expect(view.result.current.attack).toBeUndefined();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("en passant approaches the landing square and damages the adjacent victim", async () => {
    const view = await setup({ ep: true, killed: true });
    await act(() => view.result.current.move({ from: "e5", to: "d6" }));
    expect(view.result.current.attack?.to).toBe("d6");
    act(() => vi.advanceTimersByTime(420));
    expect(view.result.current.attack?.targetId).toBe(view.victim.id);
    expect(
      view.result.current.visual!.units.find((u) => u.id === view.victim.id)
        ?.square,
    ).toBe("d5");
    act(() => vi.advanceTimersByTime(420));
    expect(
      view.result.current.visual!.units.find((u) => u.id === view.pawn.id)
        ?.square,
    ).toBe("d6");
    view.unmount();
  });
  it("leaving the battle terminates its worker and ignores a retired reply", async () => {
    const view = await setup({ black: true });
    expect(workers).toHaveLength(1);
    const worker = workers[0],
      reply = worker.onmessage!,
      id = worker.postMessage.mock.calls[0][0].id;
    view.rerender({ active: false });
    expect(worker.terminate).toHaveBeenCalled();
    await act(async () =>
      reply({ data: { id, move: { from: "h8", to: "h7" } } }),
    );
    expect(view.store.getSnapshot().pve.battle!.ply).toBe(0);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
