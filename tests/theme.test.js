import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/theme.js',import.meta.url),'utf8');
const setup=({saved=null,dark=false,blocked=false}={})=>{
 const handlers={},root={dataset:{}},control={value:''},meta={setAttribute:(_,value)=>{meta.color=value;}};
 const system={matches:dark,addEventListener:(_,fn)=>{handlers.system=fn;}};
 const storage={getItem:()=>{if(blocked)throw Error();return saved;},setItem:(_,value)=>{if(blocked)throw Error();storage.saved=value;}};
 vm.runInNewContext(source,{window:{matchMedia:()=>system,addEventListener:(event,fn)=>{handlers[event]=fn;}},localStorage:storage,document:{documentElement:root,querySelector:selector=>selector.startsWith('meta')?meta:control,addEventListener:(event,fn)=>{handlers[event]=fn;}}});
 return {handlers,root,control,meta,system,storage};
};
test('Theme follows OS until the user explicitly chooses a theme',()=>{
 const c=setup({dark:true});assert.equal(c.root.dataset.theme,'dark');
 c.system.matches=false;c.handlers.system();assert.equal(c.root.dataset.theme,'light');
 c.handlers.change({target:{id:'theme-preference',value:'dark'}});
 assert.equal(c.storage.saved,'dark');c.handlers.system();assert.equal(c.root.dataset.theme,'dark');
 assert.equal(c.meta.color,'#111113');
 c.handlers.change({target:{id:'theme-preference',value:'system'}});assert.equal(c.root.dataset.theme,'light');
});
test('Theme survives reload, unavailable storage and cross-tab changes',()=>{
 assert.equal(setup({saved:'light',dark:true}).root.dataset.theme,'light');
 const c=setup({blocked:true});assert.equal(c.root.dataset.theme,'light');
 c.handlers.change({target:{id:'theme-preference',value:'dark'}});assert.equal(c.root.dataset.theme,'dark');
 c.handlers.storage({key:'gachachess-theme',newValue:'light'});assert.equal(c.control.value,'light');
 c.handlers.storage({key:'gachachess-theme',newValue:null});assert.equal(c.control.value,'system');
});
