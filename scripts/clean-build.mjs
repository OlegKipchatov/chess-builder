import {rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
// dist is generated output only. Remove previous release chunks before Vite/PWA
// computes its manifest, including when a plugin build preserves output folders.
await rm(fileURLToPath(new URL('../dist/',import.meta.url)),{recursive:true,force:true});
