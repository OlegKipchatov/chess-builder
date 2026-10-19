import { ControlIcon } from "./ControlIcon.js";
import styles from "./BackButton.module.css";

export const BackButton = ({
  onClick,
  label = "Назад",
}: {
  onClick: () => void;
  label?: string;
}) => (
  <button
    type="button"
    className={styles.button}
    aria-label={label}
    onClick={onClick}
  >
    <ControlIcon name="back" />
  </button>
);
