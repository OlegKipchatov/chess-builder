import {spawn} from 'node:child_process';
export const spawnStockfish = (version=19) => {
 if(version!==19)throw RangeError('Only Stockfish 19 is shipped');
 const child=spawn(process.execPath,[new URL('./stockfish19-cli.mjs',import.meta.url).pathname],{stdio:['pipe','pipe','pipe']});
 const worker={onmessage:null,onerror:null,postMessage:line=>child.stdin.write(line+'\n'),terminate:()=>child.kill()};
 let buffer='';
 child.stdout.on('data',chunk=>{buffer+=chunk;const lines=buffer.split('\n');buffer=lines.pop();lines.forEach(line=>worker.onmessage?.({data:line}));});
 child.on('error',error=>worker.onerror?.(error));
 child.stdin.on('error',error=>worker.onerror?.(error));
 return worker;
};
