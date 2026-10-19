import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Chess } from "chess.js";
import { readFileSync } from "node:fs";
import { Chessboard } from "../../src/features/chessboard/Chessboard";
import { chessPieces } from "../../src/features/chessboard/model";
import { initialState } from "../../src/services/persistence/state";
import { positionAt } from "../../src/domain/chess/session";
const equipped = initialState().equipped;
const scene = (pgn = "") => {
  const game = new Chess();
  if (pgn) game.loadPgn(pgn);
  return game;
};
const animations = () => {
  const cancel = vi.fn(),
    animate = vi.fn(() => ({ cancel, finished: new Promise(() => {}) }));
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: animate,
  });
  return { animate, cancel };
};
describe("React chessboard parity", () => {
  it.each(["w", "b"] as const)(
    "has one Tab stop and keeps horizontal arrows within a rank (%s)",
    (orientation) => {
      const view = render(
        <Chessboard
          pieces={chessPieces(scene())}
          equipped={equipped}
          orientation={orientation}
        />,
      );
      const cells = [
        ...view.container.querySelectorAll<HTMLButtonElement>("[data-square]"),
      ];
      expect(cells.filter((cell) => cell.tabIndex === 0)).toHaveLength(1);
      fireEvent.focus(cells[7]);
      act(() => cells[7].focus());
      fireEvent.keyDown(cells[7], { key: "ArrowRight" });
      expect(cells[7]).toHaveFocus();
      fireEvent.keyDown(cells[7], { key: "ArrowDown" });
      expect(cells[15]).toHaveFocus();
      expect(cells.filter((cell) => cell.tabIndex === 0)).toEqual([cells[15]]);
      act(() => cells[0].focus());
      fireEvent.keyDown(cells[0], { key: "ArrowLeft" });
      expect(cells[0]).toHaveFocus();
      act(() => cells[58].focus());
      fireEvent.keyDown(cells[58], { key: "ArrowDown" });
      expect(cells[58]).toHaveFocus();
    },
  );
  it("renders 64 stable squares, both orientations and semantic interaction", () => {
    const onSquare = vi.fn(),
      game = scene(),
      view = render(
        <Chessboard
          pieces={chessPieces(game)}
          equipped={equipped}
          orientation="b"
          onSquare={onSquare}
        />,
      );
    const cells = Array.from(view.container.querySelectorAll("[data-square]"));
    expect(cells).toHaveLength(64);
    expect(cells[0]).toHaveAttribute("data-square", "h1");
    fireEvent.click(cells[0]);
    expect(onSquare).toHaveBeenCalledWith("h1");
    cells[0].focus();
    fireEvent.keyDown(cells[0], { key: "ArrowDown" });
    expect(cells[8]).toHaveFocus();
    view.rerender(
      <Chessboard
        pieces={chessPieces(game)}
        equipped={equipped}
        orientation="b"
        disabled
        onSquare={onSquare}
      />,
    );
    fireEvent.click(cells[1]);
    expect(onSquare).toHaveBeenCalledTimes(1);
    expect(cells[1]).toHaveAttribute("aria-disabled", "true");
  });
  it("retains squares and untouched SVG nodes while a bot move animates only the moving pawn", () => {
    const { animate, cancel } = animations(),
      game = scene("1. e4"),
      view = render(
        <Chessboard pieces={chessPieces(game)} equipped={equipped} />,
      ),
      cells = [...view.container.querySelectorAll("[data-square]")],
      rook = view.container.querySelector('[data-piece-id="a1"] svg');
    animate.mockClear();
    game.move("e5");
    view.rerender(
      <Chessboard pieces={chessPieces(game)} equipped={equipped} />,
    );
    expect([...view.container.querySelectorAll("[data-square]")]).toEqual(
      cells,
    );
    expect(view.container.querySelector('[data-piece-id="a1"] svg')).toBe(rook);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0][1]).toMatchObject({ duration: 420 });
    view.unmount();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it("selection keeps last move, capture targets and check distinct", () => {
    const game = scene("1. e4 d5"),
      view = render(
        <Chessboard
          pieces={chessPieces(game)}
          equipped={equipped}
          selected="e4"
          legal={["e5", "d5"]}
          last={{ from: "d7", to: "d5" }}
          check="e1"
        />,
      );
    expect(view.container.querySelector(".board")).toHaveClass("has-selection");
    expect(view.container.querySelector('[data-square="e4"]')).toHaveClass(
      "selected",
    );
    expect(view.container.querySelector('[data-square="d5"]')).toHaveClass(
      "last",
      "legal",
      "capture",
    );
    expect(view.container.querySelector('[data-square="e5"]')).not.toHaveClass(
      "capture",
    );
    const ringRule = readFileSync("src/shared/styles/board.css", "utf8").match(
      /\.square\.legal\.capture:after\s*\{([^}]+)\}/,
    )?.[1];
    expect(ringRule).toContain("border: 4px solid var(--board-capture)");
    expect(ringRule).toContain("background: transparent");
    expect(view.container.querySelector('[data-square="e1"]')).toHaveClass(
      "check",
    );
  });
  it("tracks identities through forward/reverse replay, castling, en passant and promotion", () => {
    for (const [fen, moves, expected] of [
      [undefined, ["e4", "e5", "Nf3"], [["g1", "f3"]]],
      [
        "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
        ["O-O"],
        [
          ["e1", "g1"],
          ["h1", "f1"],
        ],
      ],
      [undefined, ["e4", "a6", "e5", "d5", "exd6"], [["e2", "d6"]]],
      ["7k/P7/8/8/8/8/8/7K w - - 0 1", ["a8=Q+"], [["a7", "a8"]]],
    ] as const) {
      const game = new Chess(fen);
      moves.forEach((move) => game.move(move));
      const after = chessPieces(game);
      for (const [id, square] of expected)
        expect(after.find((p) => p.id === id)?.square).toBe(square);
      const before = chessPieces(positionAt(game, 0));
      for (const [id] of expected)
        expect(before.find((p) => p.id === id)?.square).toBe(id);
      if (game.history().at(-1) === "exd6")
        expect(after.find((p) => p.id === "d7")).toBeUndefined();
      if (fen?.includes("P7"))
        expect(after.find((p) => p.id === "a7")?.type).toBe("q");
    }
  });
  it("reduced motion skips animation and capture timers", () => {
    const { animate } = animations();
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.useFakeTimers();
    const game = scene("1. e4 d5"),
      view = render(
        <Chessboard pieces={chessPieces(game)} equipped={equipped} />,
      );
    game.move("exd5");
    view.rerender(
      <Chessboard pieces={chessPieces(game)} equipped={equipped} />,
    );
    expect(animate).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    view.unmount();
    vi.useRealTimers();
  });
  it("uses requested capture duration and removes ghosts on completion", () => {
    vi.useFakeTimers();
    const game = scene("1. e4 d5"),
      view = render(
        <Chessboard
          pieces={chessPieces(game)}
          equipped={equipped}
          duration={160}
        />,
      );
    game.move("exd5");
    view.rerender(
      <Chessboard
        pieces={chessPieces(game)}
        equipped={equipped}
        duration={160}
      />,
    );
    expect(
      view.container.querySelector('[style*="animation-duration: 160ms"]'),
    ).toBeTruthy();
    act(() => vi.advanceTimersByTime(160));
    expect(
      view.container.querySelector('[style*="animation-duration"]'),
    ).toBeNull();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
