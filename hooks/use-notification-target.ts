'use client';
import { useEffect, useRef } from 'react';
/** Apply a notification target once on arrival, and again on an explicit Review action. */
export function useNotificationTarget(onTarget:(url:URL)=>void,ready=true){
 const callback=useRef(onTarget);callback.current=onTarget;
 useEffect(()=>{
  if(!ready)return;
  const apply=(event?:Event)=>{const value=event instanceof CustomEvent&&typeof event.detail==='string'?event.detail:window.location.href;try{const url=new URL(value,window.location.origin);if(url.origin===window.location.origin)callback.current(url);}catch{/* Ignore malformed or cross-origin navigation. */}};
  apply();window.addEventListener('portal:notification-target',apply);window.addEventListener('popstate',apply);
  return()=>{window.removeEventListener('portal:notification-target',apply);window.removeEventListener('popstate',apply);};
 },[ready]);
}
