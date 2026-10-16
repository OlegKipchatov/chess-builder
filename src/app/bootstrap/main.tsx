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
import { canonicalHashLocation } from "./hash-location.js";
const canonicalLocation = canonicalHashLocation(location.href);
if (canonicalLocation !== location.pathname + location.search + location.hash)
  history.replaceState(history.state, "", canonicalLocation);
const vault = createVaultStore(
    {
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value),
    },
    navigator.locks,
  ),
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
