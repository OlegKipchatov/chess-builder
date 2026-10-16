import {build} from 'vite';
import {resolve} from 'node:path';
await build({configFile:false,base:'./',publicDir:resolve('public'),worker:{format:'es'},build:{outDir:'build/browser-probe',target:'es2022',emptyOutDir:true,sourcemap:true,rollupOptions:{input:resolve('tests/browser/engine-probe.ts'),preserveEntrySignatures:'strict',output:{entryFileNames:'probe.js'}}}});
