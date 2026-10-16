import { createContext, useContext } from "react";
export const ShellPresentation = createContext<(match: boolean) => void>(
  () => {},
);
export const useShellPresentation = () => useContext(ShellPresentation);
