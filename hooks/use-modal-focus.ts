'use client';
import {useEffect,useRef,type RefObject} from 'react';

/** Keep keyboard focus in the topmost extracted dialog and restore its opener. */
export function useModalFocus(container:RefObject<HTMLElement|null>,onClose:()=>void,open=true) {
  const close=useRef(onClose);close.current=onClose;
  // Remember what had focus when the dialog was asked to open. Render runs before the dialog, or an autoFocus field in it, takes
  // focus, so this is the real opener; reading document.activeElement inside the effect would find the dialog's own field.
  const origin=useRef<Element|null>(null),wasOpen=useRef(false);
  if(open&&!wasOpen.current)origin.current=typeof document==='undefined'?null:document.activeElement;
  wasOpen.current=open;
  useEffect(()=>{
    if(!open)return;
    const opener=origin.current;
    const controls=()=>Array.from(container.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')??[]).filter(node=>node.getClientRects().length>0);
    let frame=0,attempt=0;
    // Respect a field that already took focus (autoFocus); otherwise focus the first control. A dialog rendered through <Portal> (or loaded
    // lazily) appears a few frames after this effect runs on a busy or throttled device, so keep waiting for it (about half a second).
    const focus=()=>{if(container.current){if(!container.current.contains(document.activeElement))(controls()[0]??container.current).focus();}else if(attempt++<30)frame=requestAnimationFrame(focus);};
    frame=requestAnimationFrame(focus);
    const keydown=(event:KeyboardEvent)=>{
      // The topmost modal owns the keyboard. A dialog that is animating out is inert and no longer counts, and an alert dialog (a notice or a
      // confirmation) always sits above the page's own dialogs even though it comes earlier in the document.
      const dialogs=Array.from(document.querySelectorAll('[aria-modal="true"]')).filter(node=>!node.closest('[inert]'));
      const alerts=dialogs.filter(node=>node.getAttribute('role')==='alertdialog');
      if((alerts.length?alerts:dialogs).at(-1)!==container.current)return;
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current();}
      if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(!first){event.preventDefault();container.current?.focus();}else if(event.shiftKey&&(document.activeElement===first||!container.current?.contains(document.activeElement))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&(document.activeElement===last||!container.current?.contains(document.activeElement))){event.preventDefault();first.focus();}}
    };
    document.addEventListener('keydown',keydown,true);
    return()=>{
      cancelAnimationFrame(frame);document.removeEventListener('keydown',keydown,true);
      if(opener instanceof HTMLElement&&opener.isConnected&&opener!==document.body)opener.focus();
      // The control that opened the dialog is gone (it sat inside the dialog, or the page re-rendered, or Safari never focused it on click):
      // park focus in the page content rather than letting it fall back to the top of the document.
      else document.getElementById('portal-main')?.focus({preventScroll:true});
    };
  },[container,open]);
}
