import {parentPort} from 'node:worker_threads';
globalThis.self={postMessage:data=>parentPort.postMessage(data)};
await import('../../dist/bot-worker.js');
parentPort.on('message',data=>self.onmessage({data}));
