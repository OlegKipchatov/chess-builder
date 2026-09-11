import {spawn} from 'node:child_process';
export const spawnStockfish = (version=18) => {
 const child=spawn(process.execPath,[new URL(version===19?'./stockfish19-cli.mjs':'../dist/vendor/stockfish-18-lite-single.js',import.meta.url).pathname],{stdio:['pipe','pipe','pipe']});
 const worker={onmessage:null,onerror:null,postMessage:line=>child.stdin.write(line+'\n'),terminate:()=>child.kill()};
 let buffer='';
 child.stdout.on('data',chunk=>{buffer+=chunk;const lines=buffer.split('\n');buffer=lines.pop();lines.forEach(line=>worker.onmessage?.({data:line}));});
 child.on('error',error=>worker.onerror?.(error));
 child.stdin.on('error',error=>worker.onerror?.(error));
 return worker;
};
