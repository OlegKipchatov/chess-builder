import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const assets={
 'stockfish-18-lite-single.js':'2278005057f381491f1c9bb3e44c9f5920b3a00bef9759e33cc6582769a1f1fe',
 'stockfish-18-lite-single.wasm':'a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1'
};
const root=new URL('../dist/vendor/',import.meta.url);
await mkdir(root,{recursive:true});
for(const [name,hash] of Object.entries(assets)){
 const path=new URL(name,root);
 let bytes=await readFile(path).catch(()=>null);
 if(!bytes||createHash('sha256').update(bytes).digest('hex')!==hash){
  const response=await fetch(`https://github.com/nmrugg/stockfish.js/releases/download/v18.0.0/${name}`,{signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw Error(`Stockfish download failed: ${response.status}`);
  bytes=Buffer.from(await response.arrayBuffer());
  if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error(`Stockfish integrity mismatch: ${name}`);
  await writeFile(path,bytes);
 }
}
// Node tests use CommonJS; the browser loads the unchanged classic worker.
await writeFile(new URL('package.json',root),' {"type":"commonjs"}\n');
console.log('Stockfish 18 lite single: verified JS and WASM (7.3 MB).');
