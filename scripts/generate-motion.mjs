import {readFile, writeFile} from 'node:fs/promises';
import {motionDuration, motionEasing} from '../dist/ui/motion.js';
const css = '/* Generated from ui/motion.js. Run npm run motion:generate. */\n:root{\n' +
  Object.entries(motionDuration).map(([name, value]) => `  --motion-${name}: ${value}ms;`).join('\n') + '\n' +
  Object.entries(motionEasing).map(([name, value]) => `  --motion-ease-${name}: ${value};`).join('\n') + '\n}\n';
const target = new URL('../dist/ui/styles/motion.css', import.meta.url);
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== css) throw new Error('Motion CSS is stale: run npm run motion:generate');
} else await writeFile(target, css);
