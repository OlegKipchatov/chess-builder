import createStockfish from '../dist/vendor/sf19/sf_19_smallnet.js';
import {readFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';
const sf=await createStockfish();
sf.listen=line=>process.stdout.write(line+'\n');
sf.onError=message=>{process.stderr.write(message+'\n');process.exit(1);};
sf.setNnueBuffer(new Uint8Array(await readFile(new URL('../dist/vendor/sf19/nn-61e7af4bb97d.nnue',import.meta.url))),0);
const input=createInterface({input:process.stdin});
input.on('line',line=>sf.uci(line));input.on('close',()=>process.exit(0));
