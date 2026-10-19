import type { ReactNode } from "react";
import { ControlIcon } from "./ControlIcon.js";

export const GameHeader = ({
  title,
  status,
  onExit,
  exitLabel,
  exitId,
  exitDisabled = false,
}: {
  title: ReactNode;
  status?: ReactNode;
  onExit: () => void;
  exitLabel: string;
  exitId?: string;
  exitDisabled?: boolean;
}) => (
  <div className="game-header">
    <div className="game-header-content">
      <h1 className="game-header-title">{title}</h1>
      {status != null && <div className="game-header-status">{status}</div>}
    </div>
    <button
      id={exitId}
      type="button"
      className="game-header-exit"
      aria-label={exitLabel}
      disabled={exitDisabled}
      onClick={onExit}
    >
      <ControlIcon name="close" />
    </button>
  </div>
);
