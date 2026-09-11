import {createRootRoute,HeadContent,Outlet,Scripts} from '@tanstack/react-router';
import {Provider} from '../app/context';
import {Shell} from '../app/Shell';
import css from '../app/base.css?url';
export const Route=createRootRoute({head:()=>({meta:[{charSet:'utf-8'},{name:'viewport',content:'width=device-width, initial-scale=1, viewport-fit=cover'},{name:'theme-color',content:'#111416'},{title:'Chess Vault · Preprod'}],links:[{rel:'stylesheet',href:css},{rel:'manifest',href:'/manifest.webmanifest'},{rel:'icon',href:'/icon-192.png'},{rel:'apple-touch-icon',href:'/icon-192.png'}]}),component:()=> <html lang="ru"><head><HeadContent/></head><body><Provider><Shell><Outlet/></Shell></Provider><Scripts/></body></html>,notFoundComponent:()=> <p>Страница не найдена. <a href="/">К игре</a></p>});
