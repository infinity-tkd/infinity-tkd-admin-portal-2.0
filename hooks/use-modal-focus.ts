'use client';
import {useEffect,useRef,type RefObject} from 'react';

/** Keep keyboard focus in the topmost extracted dialog and restore its opener. */
export function useModalFocus(container:RefObject<HTMLElement|null>,onClose:()=>void,open=true) {
  const close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    if(!open)return;
    const opener=document.activeElement;
    const controls=()=>Array.from(container.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')??[]).filter(node=>node.getClientRects().length>0);
    let frame=0,attempt=0;
    const focus=()=>{if(container.current){(controls()[0]??container.current).focus();}else if(attempt++<4)frame=requestAnimationFrame(focus);};
    frame=requestAnimationFrame(focus);
    const keydown=(event:KeyboardEvent)=>{
      const dialogs=document.querySelectorAll('[aria-modal="true"]');
      if(dialogs[dialogs.length-1]!==container.current)return;
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current();}
      if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(!first){event.preventDefault();container.current?.focus();}else if(event.shiftKey&&(document.activeElement===first||!container.current?.contains(document.activeElement))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&(document.activeElement===last||!container.current?.contains(document.activeElement))){event.preventDefault();first.focus();}}
    };
    document.addEventListener('keydown',keydown,true);
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',keydown,true);if(opener instanceof HTMLElement&&opener.isConnected)opener.focus();};
  },[container,open]);
}
