import { memo,type CSSProperties } from "react";
import { styleById } from "../../domain/catalog/catalog.js";
import type { Item } from "../../domain/catalog/types.js";
import { Piece } from "./Piece.js";

export interface ItemPreviewProps {
  item: Item;
  className?: string;
}

type BoardPreviewStyle = CSSProperties & {
  "--square-light": string;
  "--square-dark": string;
};

/** A collectible preview; its parent supplies the item's name and interaction. */
export const ItemPreview = memo(({ item, className }: ItemPreviewProps) => {
  if (item.kind === "piece") {
    return (
      <div
        className={className ? `piece-pair ${className}` : "piece-pair"}
        aria-hidden="true"
      >
        <Piece type={item.type} color="w" style={item.style} />
        <Piece type={item.type} color="b" style={item.style} />
      </div>
    );
  }

  const theme = styleById(item.style);
  const boardStyle: BoardPreviewStyle = {
    "--square-light": theme.light,
    "--square-dark": theme.dark,
  };

  return (
    <div
      className={className ? `mini-board ${className}` : "mini-board"}
      style={boardStyle}
      aria-hidden="true"
    >
      {Array.from({ length: 16 }, (_, index) => (
        <span
          key={index}
          className={(Math.floor(index / 4) + index) % 2 ? "dark" : ""}
        />
      ))}
    </div>
  );
});

ItemPreview.displayName = "ItemPreview";
