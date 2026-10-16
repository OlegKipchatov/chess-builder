export type PveView = "map" | "army" | "bag" | "battle";
export const PveIcon = ({
  kind,
}: {
  kind: Exclude<PveView, "battle"> | "stone" | "core";
}) => (
  <svg
    viewBox={kind === "stone" || kind === "core" ? "0 0 32 32" : "0 0 24 24"}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {kind === "map" ? (
      <path d="M5 21c-4-7 16-5 12-11S7 9 9 3M9 3h8l-2 3 2 3H9M9 3v9" />
    ) : kind === "army" ? (
      <path d="M8 4h8l-1 5 3 10H6L9 9zM9 9h6M5 21h14M12 2v4" />
    ) : kind === "bag" ? (
      <>
        <rect x="5" y="6" width="14" height="15" rx="4" />
        <path d="M9 6V4a3 3 0 0 1 6 0v2M8 13h8v5H8z" />
      </>
    ) : kind === "stone" ? (
      <path d="m10 4 13 3 5 14-13 8L4 18Z M10 4l5 25M23 7 4 18l24 3M10 4l18 17" />
    ) : (
      <>
        <path d="m16 3 11 6.5v13L16 29 5 22.5v-13Z" />
        <circle cx="16" cy="16" r="5" />
        <path d="M16 3v5M27 9.5l-4.3 2.5M27 22.5 22.7 20M16 29v-5M5 22.5 9.3 20M5 9.5 9.3 12" />
      </>
    )}
  </svg>
);
