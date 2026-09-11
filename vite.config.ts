import {defineConfig} from 'vite';
import {tanstackStart} from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[tanstackStart({spa:{enabled:true,prerender:{outputPath:'/index.html'}}}),react()],preview:{host:'127.0.0.1'},server:{host:'0.0.0.0',port:3000,headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}},build:{outDir:'build'}});
