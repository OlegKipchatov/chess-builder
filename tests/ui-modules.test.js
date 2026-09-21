import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,relative} from 'node:path';
import {mountAppShell} from '../dist/ui/shell.js';
import {renderCollection} from '../dist/collection.js';
import {initialState} from '../dist/state.js';
import {pageHeader,button} from '../dist/ui/primitives.js';
import {savedSetRow} from '../dist/ui/components/equipment.js';
const rootPath=fileURLToPath(new URL('../dist/',import.meta.url));
const files = directory => readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()&&entry.name!=='vendor'?files(resolve(directory,entry.name)):entry.isFile()?[resolve(directory,entry.name)]:[]);
test('Собранная оболочка содержит все страницы и уникальные точки подключения контроллера',()=>{
 const root={};mountAppShell(root);const html=root.innerHTML;
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(ids.length,new Set(ids).size);
 for(const id of ['play','profile','collection','chests','archive','statistics','calendar','faq','board','modal','close-modal','abort-failed','retry-failed','archive-return','profile-played'])assert.ok(ids.includes(id),id);
 assert.equal((html.match(/class="tab"/g)||[]).length,8);
 assert.ok(html.includes('Прогресс на этом устройстве'));
});
test('Общие шаблоны экранируют текст и названия пользовательских наборов',()=>{
 const hostile='"><img src=x onerror=alert(1)>';
 assert.ok(!pageHeader({title:hostile}).includes('<img'));
 assert.ok(!button({label:hostile,'aria-label':hostile}).includes('<img'));
 const state=initialState();assert.ok(!savedSetRow({id:hostile,name:hostile,...state.equipped}).includes('<img'));
});
test('В моих наборах одно действие сохранения; фильтр и предметные действия сохраняются',()=>{
 const root={},state=initialState();renderCollection(root,state,'saved');
 assert.equal((root.innerHTML.match(/data-save-set/g)||[]).length,1);
 renderCollection(root,state,'items','k',true);
 assert.ok(root.innerHTML.includes('aria-pressed="true"'));
 assert.ok(!root.innerHTML.includes('data-craft='));
 renderCollection(root,state,'items','k',false);
 assert.ok(root.innerHTML.includes('data-craft='));
});
test('Все вложенные JS/CSS-модули существуют и входят в атомарный офлайн-кэш',()=>{
 const sw=readFileSync(resolve(rootPath,'sw.js'),'utf8');
 for(const file of files(rootPath).filter(path=>/\.(js|css)$/.test(path)&&!path.endsWith('/sw.js'))){
  const source=readFileSync(file,'utf8'),name='./'+relative(rootPath,file);
  assert.ok(sw.includes(`'${name}'`),name);
  const imports=[...source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g),...source.matchAll(/@import\s+url\(['"](\.[^'"]+)['"]\)/g)];
  for(const match of imports){const [target,version]=match[1].split('?');assert.ok(existsSync(resolve(dirname(file),target)),`${name}: ${target}`);if(!target.includes('/vendor/'))assert.equal(version,'v=28',`${name}: ${target}`);}
 }
});
