import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
test('Возврат в список доступен во время анимации и останавливает повтор',()=>{
  const calls=[];
  const context=vm.createContext({analysisController:null,disposeAnalysis:null,displayMatch:{kind:'archive'},animating:true,pendingResult:false,queuedCursor:3,reviewCursor:2,state:{},game:{},
    stopReplay:()=>calls.push('stop'),navigationTarget:(_s,_g,tab)=>tab,active:()=>false,render:()=>{},syncNavigation:()=>{},renderArchive:()=>{},restoreArchiveContext:()=>calls.push('focus'),
    window:{history:{replaceState:()=>{}}},$:()=>({getAnimations:()=>[{cancel:()=>calls.push('cancel')}]}),currentScreen:'play'});
  vm.runInContext(source.slice(source.indexOf('const changeTab ='),source.indexOf('const showHistory ='))+';changeTab("archive");',context);
  assert.equal(context.currentScreen,'archive');assert.equal(context.displayMatch,null);assert.equal(context.animating,false);assert.equal(context.queuedCursor,undefined);
  assert.deepEqual(calls,['stop','cancel','focus']);
  assert.doesNotMatch(source,/\$\('#archive-return'\)\.disabled/);
});
test('Завершение старой анимации не изменяет новый экран',()=>{
  assert.match(source,/if\(displayMatch!==matchAtStart\)return;/);
});
