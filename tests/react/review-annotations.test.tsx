import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import {
  boardAnnotation,
  moveAnnotation,
} from "../../src/features/game-review/annotations";
import { MoveNavigation } from "../../src/features/game-review/MoveNavigation";
import { MoveList } from "../../src/features/game-review/MoveList";
import { Chessboard } from "../../src/features/chessboard/Chessboard";
import { chessPieces } from "../../src/features/chessboard/model";
import { initialState } from "../../src/services/persistence/state";
import type { MoveAnalysis } from "../../src/domain/analysis/types";
const move = (overrides: Partial<MoveAnalysis> = {}): MoveAnalysis => ({
  ply: 1,
  actor: "player",
  fenBefore: "",
  fenAfter: "",
  playedMove: "e2e4",
  playedSan: "e4",
  status: "complete",
  alternatives: [],
  autoPause: true,
  quality: "blunder",
  ...overrides,
});
describe("v132 analysis visual semantics", () => {
  it("retains distinct symbols and excellent precedence", () => {
    expect(
      ["inaccuracy", "mistake", "blunder"].map(
        (quality) =>
          moveAnnotation(move({ quality: quality as MoveAnalysis["quality"] }))
            .symbol,
      ),
    ).toEqual(["?!", "?", "??"]);
    expect(moveAnnotation(move({ highlight: "excellent" }))).toMatchObject({
      quality: "excellent",
      symbol: "!",
    });
    expect(boardAnnotation(move({ repeatedOpportunity: true }))).toBeNull();
    expect(boardAnnotation(move({ status: "unavailable" }))).toBeNull();
    expect(boardAnnotation(move({ quality: "good" }))).toBeNull();
  });
  it("colours timeline marks, selects current mark and seeks the original ply", () => {
    const onSeek = vi.fn();
    render(
      <MoveNavigation
        cursor={1}
        total={20}
        onSeek={onSeek}
        markers={[
          moveAnnotation(move()),
          moveAnnotation(move({ ply: 7, quality: "inaccuracy" })),
        ]}
      />,
    );
    const current = screen.getByRole("button", { name: /Разбор хода 1:/ });
    expect(current).toHaveAttribute("data-quality", "blunder");
    expect(current).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: /Разбор хода 4:/ }));
    expect(onSeek).toHaveBeenCalledWith(7);
  });
  it("preserves quality and symbols on the selected desktop move", () => {
    render(
      <MoveList
        moves={["e4", "e5"]}
        cursor={1}
        onSeek={() => {}}
        annotations={[moveAnnotation(move())]}
      />,
    );
    const button = screen.getByRole("button", { name: /e4, Грубая ошибка/ });
    expect(button).toHaveAttribute("data-quality", "blunder");
    expect(button).toHaveAttribute("aria-current", "step");
    expect(button).toHaveTextContent("??");
  });
  it("anchors the badge to the played destination for both orientations and removes it for hints", () => {
    const game = new Chess();
    game.move("e4");
    const props = {
      pieces: chessPieces(game),
      equipped: initialState().equipped,
      disabled: true,
    };
    const view = render(
      <Chessboard {...props} annotation={boardAnnotation(move())} />,
    );
    expect(screen.getByRole("img", { name: /e4: Грубая ошибка/ })).toHaveStyle({
      left: "50%",
      top: "50%",
    });
    view.rerender(
      <Chessboard
        {...props}
        orientation="b"
        annotation={boardAnnotation(move())}
      />,
    );
    expect(screen.getByRole("img", { name: /e4: Грубая ошибка/ })).toHaveStyle({
      left: "37.5%",
      top: "37.5%",
    });
    view.rerender(<Chessboard {...props} annotation={null} arrow="e2e4" />);
    expect(screen.queryByRole("img", { name: /e4: Грубая ошибка/ })).toBeNull();
  });
});
