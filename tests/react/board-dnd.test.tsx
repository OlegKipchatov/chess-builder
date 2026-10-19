import { createPortal } from "react-dom";
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Chess, type Color, type Square } from "chess.js";
import {
  Chessboard,
  BoardDragSource,
  type ChessboardProps,
} from "../../src/features/chessboard/Chessboard";
import { boardPoint, chessPieces } from "../../src/features/chessboard/model";
import { initialState } from "../../src/services/persistence/state";

const equipped = initialState().equipped;
let orientation: Color = "w";
const point = (square: string) => {
  const { x, y } = boardPoint(square, orientation);
  return { clientX: 20 + x * 50 + 25, clientY: 20 + y * 50 + 25 };
};
const rect = (left: number, top: number, width = 50, height = 50) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  x: left,
  y: top,
  toJSON: () => ({}),
});
beforeEach(() => {
  orientation = "w";
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function () {
      const square = this.dataset.square;
      if (square) {
        const p = point(square);
        return rect(p.clientX - 25, p.clientY - 25);
      }
      return rect(20, 20, 400, 400);
    },
  );
});
afterEach(async () => {
  cleanup();
  if (vi.isFakeTimers()) vi.runOnlyPendingTimers();
  vi.useRealTimers();
  // dnd-kit deliberately retains its native click blocker for 50ms after
  // release. Let that library cleanup finish before the next independent test.
  await new Promise((resolve) => setTimeout(resolve, 60));
  vi.restoreAllMocks();
});
const setup = (game = new Chess(), extra: Partial<ChessboardProps> = {}) => {
  const onMove = vi.fn(),
    onSquare = vi.fn();
  const props: ChessboardProps = {
    pieces: chessPieces(game),
    equipped,
    onMove,
    onSquare,
    moves: game.moves({ verbose: true }),
    ...extra,
  };
  const view = render(
    <StrictMode>
      <Chessboard {...props} />
    </StrictMode>,
  );
  const square = (value: string) =>
    view.container.querySelector<HTMLButtonElement>(
      `[data-square="${value}"]`,
    )!;
  const start = async (from: string) => {
    const p = point(from);
    fireEvent.mouseDown(square(from), { ...p, button: 0 });
    await act(async () => {
      fireEvent.mouseMove(document, {
        clientX: p.clientX + 10,
        clientY: p.clientY,
      });
    });
  };
  const moveTo = async (to: string) => {
    await act(async () => {
      fireEvent.mouseMove(document, point(to));
    });
  };
  const drop = async (from: string, to: string) => {
    await start(from);
    await moveTo(to);
    await act(async () => {
      fireEvent.mouseUp(document, point(to));
    });
  };
  return { view, props, square, start, moveTo, drop, onMove, onSquare };
};

describe("board drag and drop with real dnd-kit sensors", () => {
  it.each(["w", "b"] as const)(
    "moves exactly once in %s orientation and suppresses the trailing click",
    async (color) => {
      orientation = color;
      const board = setup(new Chess(), {
        orientation: color,
        selected: "b1",
        legal: ["a3", "c3"],
      });
      await board.start("e2");
      expect(board.square("e2")).toHaveClass("selected");
      expect(board.square("e4")).toHaveClass("legal");
      expect(board.square("c3")).not.toHaveClass("legal");
      expect(
        board.view.container.querySelector('[data-piece-id="e2"]'),
      ).toHaveStyle({ visibility: "hidden" });
      await board.moveTo("e4");
      expect(board.square("e4")).toHaveAttribute("data-drop-target", "true");
      await act(async () => {
        fireEvent.mouseUp(document, point("e4"));
      });
      fireEvent.click(board.square("e4"), { detail: 1 });
      expect(board.onMove).toHaveBeenCalledExactlyOnceWith("e2", "e4");
      expect(board.onSquare).not.toHaveBeenCalled();
    },
  );
  it("keeps the dropped piece at its destination while persistence and React commit are delayed", async () => {
    const game = new Chess();
    let finish!: (accepted: boolean) => void;
    const pending = new Promise<boolean>((resolve) => {
      finish = resolve;
    });
    const board = setup(game, {
      onMove: () => pending,
      last: { from: "d7", to: "d5" },
      selected: "b1",
      legal: ["a3", "c3"],
    });
    const expectPendingHighlight = () => {
      expect(board.square("e2")).toHaveClass("last");
      expect(board.square("e4")).toHaveClass("last");
      expect(board.square("d7")).not.toHaveClass("last");
      expect(board.square("d5")).not.toHaveClass("last");
      expect(board.view.container.querySelector(".has-selection")).toBeNull();
      expect(board.square("c3")).not.toHaveClass("legal");
    };
    const piece = board.view.container.querySelector<HTMLElement>(
      '[data-piece-id="e2"]',
    )!;
    await board.drop("e2", "e4");
    expect(piece).toHaveStyle({ top: "50%", visibility: "visible" });
    expectPendingHighlight();
    board.view.rerender(
      <StrictMode>
        <Chessboard {...board.props} disabled />
      </StrictMode>,
    );
    expect(piece).toHaveStyle({ top: "50%" });
    expectPendingHighlight();
    // A second touch during saving must not reset the pending presentation.
    fireEvent.mouseDown(board.square("e4"), { ...point("e4"), button: 0 });
    expect(piece).toHaveStyle({ top: "50%" });
    expectPendingHighlight();
    await act(async () => finish(true));
    expect(piece).toHaveStyle({ top: "50%" });
    expectPendingHighlight();
    game.move("e4");
    board.view.rerender(
      <StrictMode>
        <Chessboard
          {...board.props}
          pieces={chessPieces(game)}
          last={{ from: "e2", to: "e4" }}
          selected={null}
          legal={[]}
          disabled
        />
      </StrictMode>,
    );
    expect(board.view.container.querySelector('[data-piece-id="e2"]')).toBe(
      piece,
    );
    expect(piece).toHaveStyle({ top: "50%" });
    expectPendingHighlight();
  });
  it.each([false, "reject"])(
    "restores the source when a pending move is cancelled or fails (%s)",
    async (outcome) => {
      let finish!: (accepted: boolean) => void;
      let fail!: () => void;
      const pending = new Promise<boolean>((resolve, reject) => {
        finish = resolve;
        fail = () => reject(new Error("Storage unavailable"));
      });
      const board = setup(new Chess(), {
        onMove: () => pending,
        last: { from: "d7", to: "d5" },
      });
      await board.drop("e2", "e4");
      const piece = board.view.container.querySelector('[data-piece-id="e2"]');
      expect(piece).toHaveStyle({ top: "50%" });
      await act(async () => {
        if (outcome === "reject") fail();
        else finish(false);
      });
      expect(piece).toHaveStyle({ top: "75%", visibility: "visible" });
      expect(board.square("d7")).toHaveClass("last");
      expect(board.square("d5")).toHaveClass("last");
      expect(board.square("e2")).not.toHaveClass("last");
      expect(board.square("e4")).not.toHaveClass("last");
    },
  );
  it.each([
    ["w", "mouse"],
    ["b", "mouse"],
    ["w", "touch"],
    ["b", "touch"],
  ] as const)(
    "drags a reserve piece onto a legal square in %s orientation with %s",
    async (color, input) => {
      orientation = color;
      const to = color === "w" ? "a3" : "a6";
      const onReserveMove = vi.fn(() => true);
      const reserveContainer = document.createElement("div");
      document.body.append(reserveContainer);
      const board = setup(new Chess(), {
        orientation: color,
        pieces: [],
        reservePieces: [
          {
            id: "reserve-pawn",
            square: "reserve:reserve-pawn",
            type: "p",
            color,
          },
        ],
        reserveContent: createPortal(
          <BoardDragSource source="reserve:reserve-pawn" data-testid="reserve">
            Pawn
          </BoardDragSource>,
          reserveContainer,
        ),
        moves: [{ from: "reserve:reserve-pawn", to }],
        onReserveMove,
      });
      const source = board.view.getByTestId("reserve");
      if (input === "touch") {
        fireEvent.touchStart(source, {
          touches: [{ identifier: 1, clientX: 220, clientY: 220 }],
        });
        await act(async () =>
          fireEvent.touchMove(source, {
            touches: [{ identifier: 1, clientX: 230, clientY: 220 }],
          }),
        );
      } else {
        fireEvent.mouseDown(source, { clientX: 220, clientY: 220, button: 0 });
        await act(async () =>
          fireEvent.mouseMove(document, { clientX: 230, clientY: 220 }),
        );
      }
      expect(board.square(to)).toHaveClass("legal");
      expect(board.square(color === "w" ? "a4" : "a5")).not.toHaveClass(
        "legal",
      );
      if (input === "touch") {
        await act(async () =>
          fireEvent.touchMove(source, {
            touches: [{ identifier: 1, ...point(to) }],
          }),
        );
        await act(async () =>
          fireEvent.touchEnd(source, {
            touches: [],
            changedTouches: [{ identifier: 1, ...point(to) }],
          }),
        );
      } else {
        await board.moveTo(to);
        await act(async () => fireEvent.mouseUp(document, point(to)));
      }
      expect(onReserveMove).toHaveBeenCalledExactlyOnceWith("reserve-pawn", to);
      expect(board.onMove).not.toHaveBeenCalled();
      reserveContainer.remove();
    },
  );
  it("keeps clicks available below the activation threshold", () => {
    const board = setup();
    fireEvent.mouseDown(board.square("e2"), { ...point("e2"), button: 0 });
    fireEvent.mouseMove(document, {
      ...point("e2"),
      clientX: point("e2").clientX + 2,
    });
    fireEvent.mouseUp(document, point("e2"));
    fireEvent.click(board.square("e2"));
    expect(board.onSquare).toHaveBeenCalledExactlyOnceWith("e2");
    expect(board.onMove).not.toHaveBeenCalled();
  });
  it.each(["e5", "d2", "e2"])(
    "rejects illegal, occupied-own, or unchanged destination %s",
    async (to) => {
      const board = setup();
      await board.drop("e2", to);
      expect(board.onMove).not.toHaveBeenCalled();
    },
  );
  it("rejects drops outside the board instead of choosing the nearest square", async () => {
    const board = setup();
    await board.start("e2");
    await act(async () => {
      fireEvent.mouseMove(document, { clientX: 700, clientY: 700 });
    });
    fireEvent.mouseUp(document, { clientX: 700, clientY: 700 });
    expect(board.onMove).not.toHaveBeenCalled();
  });
  it("does not pick up the opponent, empty squares, or a locked board", async () => {
    const board = setup();
    for (const from of ["e7", "e4"]) await board.drop(from, "e5");
    expect(board.onMove).not.toHaveBeenCalled();
    board.view.rerender(<Chessboard {...board.props} disabled />);
    await board.drop("e2", "e4");
    expect(board.onMove).not.toHaveBeenCalled();
  });
  it("cancels with Escape and cleans up a gesture on unmount", async () => {
    const board = setup();
    await board.start("e2");
    fireEvent.keyDown(document, { code: "Escape", key: "Escape" });
    await board.moveTo("e4");
    fireEvent.mouseUp(document, point("e4"));
    expect(board.onMove).not.toHaveBeenCalled();
    await board.start("e2");
    board.view.unmount();
    fireEvent.mouseUp(document, point("e4"));
    expect(board.onMove).not.toHaveBeenCalled();
  });
  it("invalidates a gesture across a temporary lock, even when the same position returns", async () => {
    const board = setup();
    await board.start("e2");
    board.view.rerender(
      <StrictMode>
        <Chessboard {...board.props} disabled />
      </StrictMode>,
    );
    board.view.rerender(
      <StrictMode>
        <Chessboard {...board.props} />
      </StrictMode>,
    );
    await board.moveTo("e4");
    fireEvent.mouseUp(document, point("e4"));
    expect(board.onMove).not.toHaveBeenCalled();
  });
  it.each([
    ["r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1", "g1"],
    ["7k/8/8/3pP3/8/8/8/7K w - d6 0 1", "e5", "d6"],
    ["7k/P7/8/8/8/8/8/7K w - - 0 1", "a7", "a8"],
    ["7k/8/8/3p4/4P3/8/8/7K w - - 0 1", "e4", "d5"],
  ])(
    "forwards castling, en passant, promotion and capture through the move callback: %s",
    async (fen, from, to) => {
      const board = setup(new Chess(fen));
      await board.drop(from, to);
      expect(board.onMove).toHaveBeenCalledExactlyOnceWith(from, to);
    },
  );
  it("starts touch dragging without a hold delay and supports cancellation", async () => {
    vi.useFakeTimers();
    const board = setup();
    const touch = (square: Square) => ({
      identifier: 1,
      target: board.square("e2"),
      ...point(square),
    });
    fireEvent.touchStart(board.square("e2"), { touches: [touch("e2")] });
    await act(async () => {
      fireEvent.touchMove(board.square("e2"), {
        touches: [{ ...touch("e2"), clientX: point("e2").clientX + 5 }],
      });
    });
    expect(board.square("e2")).toHaveClass("selected");
    await act(async () => {
      fireEvent.touchMove(board.square("e2"), { touches: [touch("e4")] });
    });
    await act(async () => {
      fireEvent.touchEnd(board.square("e2"), {
        touches: [],
        changedTouches: [touch("e4")],
      });
    });
    expect(board.onMove).toHaveBeenCalledExactlyOnceWith("e2", "e4");
    board.onMove.mockClear();
    fireEvent.touchStart(board.square("e2"), { touches: [touch("e2")] });
    await act(async () => {
      fireEvent.touchMove(board.square("e2"), {
        touches: [{ ...touch("e2"), clientX: point("e2").clientX + 5 }],
      });
    });
    expect(board.square("e2")).toHaveClass("selected");
    fireEvent.touchCancel(board.square("e2"), { touches: [] });
    fireEvent.touchEnd(board.square("e2"), {
      touches: [],
      changedTouches: [touch("e4")],
    });
    expect(board.onMove).not.toHaveBeenCalled();
  });
});
