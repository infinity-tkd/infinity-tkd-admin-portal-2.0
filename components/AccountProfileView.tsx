'use client';

import { AccountSecurityPanel } from '@/components/AccountSecurityPanel';
import { useAppStore } from '@/lib/store';

export function AccountProfileView() {
 const { state }=useAppStore();
 const user=state.currentUser;
 if(!user)return null;
 return (
  <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
   <div>
    <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">My account</h1>
    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Your profile and account security.</p>
   </div>
   <section aria-label="Your profile" className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950 sm:p-5">
    <h2 className="text-base font-semibold text-neutral-900 dark:text-white">{user.displayName}</h2>
    <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
     {[['Username',user.username],['Email',user.email],['Role',user.role],['Phone',user.phone]].map(([label,value])=>(
      <div key={label}><dt className="text-neutral-500 dark:text-neutral-400">{label}</dt><dd className="mt-1 break-words text-neutral-900 dark:text-neutral-100">{value||'Not provided'}</dd></div>
     ))}
    </dl>
   </section>
   <AccountSecurityPanel />
  </div>
 );
}
