import { supabase } from './supabase';
/** A shared device must stop receiving the previous account's alerts at sign-out. */
export async function detachPushDevice() {
 if(typeof navigator==='undefined'||!('serviceWorker' in navigator))return;
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{await Promise.race([(async()=>{
  const registration=await navigator.serviceWorker.getRegistration();
  const subscription=await registration?.pushManager?.getSubscription();
  if(!subscription)return;
  const {data:{session}}=await supabase.auth.getSession();
  await Promise.allSettled([
   subscription.unsubscribe(),
   session?fetch('/api/notifications',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'unsubscribe',endpoint:subscription.endpoint}),signal:AbortSignal.timeout(5000)}):Promise.resolve(),
  ]);
 })(),new Promise<void>(resolve=>{timer=setTimeout(resolve,6000);})]);
 }catch{/* A device API failure must not trap the user in an authenticated session. */}
 finally{clearTimeout(timer);}
}
