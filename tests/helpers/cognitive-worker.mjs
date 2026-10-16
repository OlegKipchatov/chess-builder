import {parentPort} from 'node:worker_threads';
globalThis.postMessage=data=>parentPort.postMessage(data);
await import('../../src/workers/cognitive/worker.ts');
parentPort.on('message',data=>globalThis.onmessage({data}));
