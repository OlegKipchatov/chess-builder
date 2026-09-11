import {useEffect,useRef,type ReactNode} from 'react';
export const Dialog=({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void})=>{
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current!,previous=document.activeElement as HTMLElement|null;dialog.showModal();return()=>{dialog.close();previous?.focus();};},[]);
 return <dialog ref={ref} className="react-dialog" aria-labelledby="dialog-title" onCancel={event=>{event.preventDefault();onClose();}}><h2 id="dialog-title">{title}</h2>{children}<button className="primary" onClick={onClose}>Продолжить</button></dialog>;
};
