import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve('.output/public');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json','.txt':'text/plain'};
createServer(async(req,res)=>{try{let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!path.startsWith(root+'/')&&path!==root){res.writeHead(403);res.end();return;}if(!(await stat(path).catch(()=>null))?.isFile())path=resolve(root,'index.html');res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cache-Control':'no-cache'});res.end(await readFile(path));}catch{res.writeHead(500);res.end();}}).listen(4173,'0.0.0.0',()=>console.log('Preprod preview http://localhost:4173'));
