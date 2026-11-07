'use client';

import { UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle';
import { AccountSecurityPanel } from '@/components/AccountSecurityPanel';
import { PageHeader } from '@/components/ui/PageHeader';
import { cardClass, sectionLabelClass } from '@/components/ui/styles';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function AccountProfileView() {
 const { state }=useAppStore();
 const user=state.currentUser;
 if(!user)return null;
 return (
  <div className="mx-auto w-full max-w-4xl space-y-4 pb-12 sm:space-y-5">
   <PageHeader icon={<UserCircle weight="bold" />} eyebrow={user.role} title="My account" description="Your profile and account security." />
   <section aria-label="Your profile" className={cn(cardClass, 'p-4 sm:p-5')}>
    <h2 className="text-base font-bold text-ink">{user.displayName}</h2>
    <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
     {[['Username',user.username],['Email',user.email],['Role',user.role],['Phone',user.phone]].map(([label,value])=>(
      <div key={label}><dt className={sectionLabelClass}>{label}</dt><dd className="mt-1 break-words text-ink">{value||'Not provided'}</dd></div>
     ))}
    </dl>
   </section>
   <AccountSecurityPanel />
  </div>
 );
}
