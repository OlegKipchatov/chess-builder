import { describe, it, expect, vi } from "vitest";
import { createVaultStore } from "../../src/services/persistence/vault-store";
import { createAutoStore } from "../../src/services/persistence/autochess-store";
import {
  initialState,
  KEY,
  PREVIOUS_KEY,
  loadState,
} from "../../src/services/persistence/state";
import { createAutoRun, AUTO_KEY } from "../../src/domain/autochess/autochess";
import { openChest } from "../../src/domain/economy/economy";
describe("atomic persistence", () => {
  it("does not publish a debit or reward when the write fails", async () => {
    const state = initialState(),
      raw = JSON.stringify(state),
      storage = {
        getItem: () => raw,
        setItem: () => {
          throw Error("quota");
        },
      },
      store = createVaultStore(storage),
      before = store.getSnapshot();
    const result = await store.update((s) => openChest(s, () => 0.5)!.state);
    expect(result.ok).toBe(false);
    expect(store.getSnapshot()).toBe(before);
    expect(store.getSnapshot().coins).toBe(100);
    expect(store.getSnapshot().opened).toBe(0);
  });
  it("serializes simultaneous purchases against the latest balance", async () => {
    const store = createVaultStore(localStorage);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        store.update((s) => openChest(s, () => 0.5)?.state || s),
      ),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect(store.getSnapshot().coins).toBe(0);
    expect(store.getSnapshot().opened).toBe(1);
    expect(JSON.parse(localStorage.getItem(KEY)!).opened).toBe(1);
  });
  it("keeps unrelated selector references stable across a move", async () => {
    const store = createVaultStore(localStorage),
      owned = store.getSnapshot().owned,
      activity = store.getSnapshot().activity;
    await store.update((s) => ({ ...s, game: { ...s.game, pgn: "1. e4" } }));
    expect(store.getSnapshot().owned).toBe(owned);
    expect(store.getSnapshot().activity).toBe(activity);
  });
  it("preserves the old key and progress during upgrade", () => {
    const old = {
      ...initialState(),
      version: 2,
      coins: 541,
      shards: 85,
      played: 17,
    };
    localStorage.setItem(PREVIOUS_KEY, JSON.stringify(old));
    const state = loadState(localStorage);
    expect(state.coins).toBe(541);
    expect(state.shards).toBe(85);
    expect(state.played).toBe(17);
    expect(localStorage.getItem(PREVIOUS_KEY)).toBe(JSON.stringify(old));
  });
  it("reopens after deleting an Autochess run", () => {
    const store = createAutoStore(localStorage);
    store.save(createAutoRun("delete-fixture"));
    store.save(null);
    expect(localStorage.getItem(AUTO_KEY)).toBe(null);
    expect(createAutoStore(localStorage).getSnapshot()).toBe(null);
  });
});

// These snapshots and expected values were emitted by the untouched v132 runtime.
import v1 from "../fixtures/persistence/v1.json";
import v2 from "../fixtures/persistence/v2.json";
import active from "../fixtures/persistence/v3-active-game.json";
import pve from "../fixtures/persistence/v3-pve-battle.json";
import auto from "../fixtures/persistence/autochess-v3.json";
import { migrateState, LEGACY_KEY } from "../../src/services/persistence/state";
import { restoreAutoRun } from "../../src/domain/autochess/autochess";
describe("real legacy serialized upgrade fixtures", () => {
  for (const [name, fixture] of Object.entries({ v1, v2, active, pve }))
    it(`matches the previous runtime migration exactly: ${name}`, () => {
      // v1 had no activity timezone. Reproduce the device where the legacy
      // fixture was captured, rather than substituting the CI runner timezone.
      const options = Intl.DateTimeFormat().resolvedOptions();
      vi.spyOn(
        Intl.DateTimeFormat.prototype,
        "resolvedOptions",
      ).mockReturnValue({ ...options, timeZone: "Europe/Copenhagen" });
      const key =
        name === "v1" ? LEGACY_KEY : name === "v2" ? PREVIOUS_KEY : KEY;
      localStorage.setItem(key, JSON.stringify(fixture.input));
      const loaded = loadState(localStorage);
      expect(loaded).toEqual(fixture.expected);
      if (key !== KEY)
        expect(JSON.parse(localStorage.getItem(key)!)).toEqual(fixture.input);
    });
  it("preserves a legacy Autochess v3 shop, reserve and opponent without regenerating them", () => {
    expect(restoreAutoRun(JSON.stringify(auto.input))).toEqual(auto.expected);
  });
});
