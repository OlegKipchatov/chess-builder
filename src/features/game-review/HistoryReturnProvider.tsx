import { createContext, useContext, useRef, type ReactNode } from "react";
export interface HistoryPosition {
  id: string | null;
  scrollTop: number;
  fromList: boolean;
  returnTo: "/play" | "/history";
}
const Context = createContext<HistoryPosition | null>(null);
export const HistoryReturnProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const state = useRef<HistoryPosition>({
    id: null,
    scrollTop: 0,
    fromList: false,
    returnTo: "/history",
  });
  return <Context value={state.current}>{children}</Context>;
};
export const useHistoryReturn = () => {
  const state = useContext(Context);
  if (!state) throw Error("HistoryReturnProvider missing");
  return state;
};
