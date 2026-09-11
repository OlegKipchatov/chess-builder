import './prepare-stockfish.mjs';
import {cp,mkdir,writeFile} from 'node:fs/promises';
await mkdir('public/engine/vendor',{recursive:true});
await cp('dist/vendor','public/engine/vendor',{recursive:true});
await writeFile('public/manifest.webmanifest',JSON.stringify({id:'chess-vault-preprod',name:'Chess Vault · Preprod',short_name:'Chess Preprod',lang:'ru',start_url:'/',scope:'/',display:'standalone',background_color:'#171b20',theme_color:'#111416',icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icon-512.png',sizes:'512x512',type:'image/png'},{src:'/icon-maskable.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]},null,2));
