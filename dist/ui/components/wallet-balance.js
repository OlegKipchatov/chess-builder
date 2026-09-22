import {escapeHTML} from '../primitives.js?v=32';
export const walletBalance = (id,title,symbol,label) => `<div class="wallet ${id==='shards'?'shards':''}" title="${escapeHTML(title)}">${symbol} <strong id="${id}">0</strong><span>${label}</span></div>`;
