import '@testing-library/jest-dom/vitest';
import {afterEach,vi} from 'vitest';
import {cleanup} from '@testing-library/react';
afterEach(()=>{cleanup();localStorage.clear();vi.useRealTimers();});
Object.defineProperty(window,'matchMedia',{writable:true,value:vi.fn().mockImplementation((query:string)=>({matches:false,media:query,onchange:null,addEventListener:vi.fn(),removeEventListener:vi.fn(),dispatchEvent:vi.fn()}))});
globalThis.ResizeObserver=class {observe(){}unobserve(){}disconnect(){}};
HTMLDialogElement.prototype.showModal=function(){this.open=true;};
HTMLDialogElement.prototype.close=function(){this.open=false;};
