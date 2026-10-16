const paths = {
  back: "M19 12H5m7 7-7-7 7-7",
  previous: "m15 5-7 7 7 7",
  next: "m9 5 7 7-7 7",
  live: "m5 5 9 7-9 7zM19 5v14",
  play: "m7 4 13 8-13 8z",
  pause: "M8 4v16M16 4v16",
  close: "m6 6 12 12M18 6 6 18",
} as const;
export const ControlIcon = ({ name }: { name: keyof typeof paths }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={paths[name]} />
  </svg>
);
