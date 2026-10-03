export const detectStockfishCapabilities = (scope=globalThis) => {
 const wasm=typeof scope.WebAssembly==='object'&&typeof scope.WebAssembly.Memory==='function';
 const isolated=scope.crossOriginIsolated===true;
 const sharedArrayBuffer=typeof scope.SharedArrayBuffer==='function';
 let sharedMemory=false,reason=null;
 if(!wasm)reason='WebAssembly unavailable';
 else if(!isolated)reason='cross-origin isolation unavailable';
 else if(!sharedArrayBuffer)reason='SharedArrayBuffer unavailable';
 else {
  try{sharedMemory=new scope.WebAssembly.Memory({initial:1,maximum:1,shared:true}).buffer instanceof scope.SharedArrayBuffer;}
  catch{reason='shared WebAssembly memory unavailable';}
  if(!sharedMemory)reason ||= 'shared WebAssembly memory unavailable';
 }
 return {wasm,isolated,sharedArrayBuffer,sharedMemory,threaded:wasm&&isolated&&sharedArrayBuffer&&sharedMemory,reason};
};
