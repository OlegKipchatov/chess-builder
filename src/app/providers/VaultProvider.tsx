import {
createContext,
useContext,
useEffect,
useState,
useSyncExternalStore,
type ReactNode,
} from "react";
import type { VaultState } from "../../domain/chess/types.js";
import { KEY } from "../../services/persistence/state.js";
import {
createVaultStore,
type VaultStore,
} from "../../services/persistence/vault-store.js";
const Context = createContext<VaultStore | null>(null);
export const VaultProvider = ({
  children,
  store,
}: {
  children: ReactNode;
  store?: VaultStore;
}) => {
  const [owned] = useState(
    () => store || createVaultStore(localStorage, navigator.locks),
  );
  useEffect(() => {
    const change = (event: StorageEvent) => {
      if (event.key === KEY) owned.refresh();
    };
    window.addEventListener("storage", change);
    return () => window.removeEventListener("storage", change);
  }, [owned]);
  return <Context value={owned}>{children}</Context>;
};
export const useVaultStore = () => {
  const store = useContext(Context);
  if (!store) throw new Error("VaultProvider missing");
  return store;
};
export const useVault = <T,>(select: (state: VaultState) => T): T => {
  const store = useVaultStore();
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.getSnapshot()),
    () => select(store.getSnapshot()),
  );
};
