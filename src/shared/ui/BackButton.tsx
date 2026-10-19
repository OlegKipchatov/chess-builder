import { ControlIcon } from "./ControlIcon.js";

export const BackButton = ({
  onClick,
  label = "Назад",
}: {
  onClick: () => void;
  label?: string;
}) => (
  <button
    type="button"
    className="back-button"
    aria-label={label}
    onClick={onClick}
  >
    <ControlIcon name="back" />
  </button>
);
