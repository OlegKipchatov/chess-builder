// Shared source for CSS and Web Animations. Run npm run motion:generate after editing.
export const motionDuration = Object.freeze({
  instant: 0,
  fast: 160,
  standard: 200,
  enter: 260,
  exit: 180,
  board: 420,
  reveal: 500,
});
export const motionEasing = Object.freeze({
  local: 'cubic-bezier(.2,0,0,1)',
  enter: 'ease-out',
  exit: 'ease-in',
  sheet: 'cubic-bezier(.16,1,.3,1)',
  board: 'cubic-bezier(.25,.1,.25,1)',
  reveal: 'ease-out',
});
