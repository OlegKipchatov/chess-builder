import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm','.json':'application/json','.css':'text/css'};
createServer(async(request,response)=>{
 try{
  const path=resolve(root,'.'+decodeURIComponent(new URL(request.url,'http://localhost').pathname));
  if(!path.startsWith(root.endsWith(sep)?root:root+sep)){response.writeHead(403);response.end();return;}
  const data=await readFile(path);
  response.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cache-Control':'no-store'});response.end(data);
 }catch{response.writeHead(404);response.end();}
}).listen(8081,'127.0.0.1',()=>console.log('http://127.0.0.1:8081/scripts/browser-worker-check.html'));
