import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {pieceSVG} from '../dist/pieces.js';
import {TYPES,STYLES} from '../dist/catalog.js';
const read = file => readFileSync(new URL('../dist/'+file,import.meta.url),'utf8');
test('Белые и чёрные SVG используют разные явные заливки, а не шрифтовые символы',()=>{for(const type of TYPES)for(const style of STYLES){assert.match(pieceSVG(type,'w',style.id),/fill="#faf8ef"/);assert.match(pieceSVG(type,'b',style.id),/fill="#202933"/);assert.doesNotMatch(pieceSVG(type,'w',style.id),/[♔-♟]/);}});
test('Все локальные зависимости HTML и модулей существуют и покрыты офлайн-кэшем',()=>{const sw=read('sw.js');const modules=['app.js','session.js','catalog.js','economy.js','state.js','pieces.js','board.js','collection.js','engine.js','bot-worker.js'];for(const file of modules){assert.ok(sw.includes(`'./${file}'`),file);for(const match of read(file).matchAll(/from\s*['"]\.\/([^'"]+)['"]/g)){const name=match[1].split('?')[0];assert.ok(existsSync(new URL('../dist/'+name,import.meta.url)),name);assert.ok(sw.includes(`'./${name}'`),name);}}const html=read('index.html');assert.ok(html.includes('./app.js?v=6'));assert.ok(html.includes('./style.css?v=6'));assert.ok(sw.includes("path+'?v=6'"));});
test('Сервис-воркер обновляет оболочку целиком и сохраняет область установки',()=>{const sw=read('sw.js');assert.ok(sw.includes('ACTIVATE_UPDATE'));assert.ok(sw.includes("caches.match('./index.html')"));const manifest=JSON.parse(read('manifest.webmanifest'));assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./');});
