import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createVaultStore } from "../../services/persistence/vault-store.js";
import "../../shared/styles/index.css";
import { OverlayProvider } from "../providers/OverlayProvider.js";
import { PwaProvider } from "../providers/PwaProvider.js";
import { ThemeProvider } from "../providers/ThemeProvider.js";
import { VaultProvider } from "../providers/VaultProvider.js";
import { makeRouter } from "../router/router.js";
const aliases: Record<string, string> = {
  archive: "history",
  analysis: "history",
  minigames: "play",
};
const oldHash = location.hash.slice(1);
if (oldHash && !oldHash.startsWith("/"))
  history.replaceState(null, "", `#/${aliases[oldHash] || oldHash}`);
const vault = createVaultStore(localStorage, navigator.locks),
  router = makeRouter(vault),
  element = document.getElementById("app");
if (!element) throw Error("Application root is missing");
createRoot(element).render(
  <StrictMode>
    <VaultProvider store={vault}>
      <ThemeProvider>
        <OverlayProvider>
          <PwaProvider>
            <RouterProvider router={router} />
          </PwaProvider>
        </OverlayProvider>
      </ThemeProvider>
    </VaultProvider>
  </StrictMode>,
);
