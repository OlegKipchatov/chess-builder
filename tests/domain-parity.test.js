import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Перенос домена сохраняет проверенные правила, экономику и миграции',()=>{for(const name of ['catalog','state','session','archive','rating','economy','strength','engine','chess']){const old=readFileSync(new URL(`../dist/${name}.js`,import.meta.url),'utf8').replace(/\?v=\d+/g,'');const current=readFileSync(new URL(`../src/domain/${name}.js`,import.meta.url),'utf8');assert.equal(current,old,name);}});
