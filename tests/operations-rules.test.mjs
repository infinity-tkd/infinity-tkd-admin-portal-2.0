import test from 'node:test';import assert from 'node:assert/strict';import {loadTs} from './load-ts.mjs';
const {portalLoadPlan}=loadTs('lib/portal-load-plan.ts');const {preserveUnavailableData}=loadTs('lib/data-load-status.ts');const {membershipBilling}=loadTs('lib/billing.ts');const {invoiceStatus}=loadTs('lib/invoice-status.ts');const {needsAdministratorMfa}=loadTs('lib/auth-assurance.ts');const {makeupCandidates}=loadTs('lib/makeup.ts');const {tuitionCollectionStats}=loadTs('lib/financial-reporting.ts');
test('page-specific loads omit unrelated datasets while preserving previous page snapshots',()=>{
 const finance=portalLoadPlan('/financials');assert.ok(finance.has('payments'));assert.ok(finance.has('membership_invoices'));for(const name of ['partners','muscles','library_assets','student_body_compositions'])assert.equal(finance.has(name),false);
 const library=portalLoadPlan('/library');assert.ok(library.has('muscles'));assert.equal(library.has('payments'),false);
 const old={payments:[{id:1}],partners:[{id:2}],students:[{id:3}]};assert.deepEqual(preserveUnavailableData(old,{payments:[],partners:[],students:[]},[],['partners']),{payments:[],partners:[{id:2}],students:[]});
});
test('page changes and invoice outages preserve cached student billing summaries without discarding fresh profile fields',()=>{
 const previous={students:[{id:'A',englishName:'Old name',billingInvoices:[{cycleMonth:'2026-10-01',amount:45,balance:35}],membershipPauses:[{startDate:'2026-10-15',resumeDate:'2026-11-15'}]}]};const incoming={students:[{id:'A',englishName:'Updated name',billingInvoices:[],membershipPauses:[]}]};
 const result=preserveUnavailableData(previous,incoming,[{dataset:'membership_invoices'}],['membership_pauses']);assert.equal(result.students[0].englishName,'Updated name');assert.deepEqual(result.students[0].billingInvoices,previous.students[0].billingInvoices);assert.deepEqual(result.students[0].membershipPauses,previous.students[0].membershipPauses);
});
test('renewal lead time, post-due grace, approved pauses and invoice balances are independent',()=>{
 const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct'];const student={id:'A',registrationDate:'2026-01-15',membershipStartDate:'2026-01-15',scholarshipId:1};const paid=months.map(month=>({studentId:'A',year:2026,month,status:'Paid'}));
 assert.equal(membershipBilling(student,paid,[],[],{renewalReminderDays:10,tuitionGracePeriodDays:0},new Date('2026-11-08T02:00:00Z')).status,'Due Soon');assert.equal(membershipBilling(student,paid,[],[],{renewalReminderDays:2,latePaymentGraceDays:15},new Date('2026-11-08T02:00:00Z')).status,'Current');
 assert.equal(invoiceStatus('2026-11-15',45,'2026-11-17',5,5),'Within grace');assert.equal(invoiceStatus('2026-11-15',45,'2026-11-21',5,5),'Overdue');assert.equal(invoiceStatus('2026-11-15',0,'2026-11-21',5,5),'Settled');
 const debt={...student,billingInvoices:[{cycleMonth:'2026-09-01',amount:30,balance:12}]};assert.equal(membershipBilling(debt,paid.filter(row=>row.month!=='Sep'),[],[],{},new Date('2026-11-08T02:00:00Z')).amountOwed,12);
 const paused={...student,membershipPauses:[{startDate:'2026-09-15',resumeDate:'2026-10-15'}]};assert.equal(membershipBilling(paused,paid.filter(row=>row.month!=='Sep'),[],[],{},new Date('2026-11-08T02:00:00Z')).nextRenewalDate,'2026-11-15');
 paused.membershipPauses[0].startDate='2026-09-16';assert.equal(membershipBilling(paused,paid.filter(row=>row.month!=='Sep'),[],[],{},new Date('2026-11-08T02:00:00Z')).nextRenewalDate,'2026-09-15');
});
test('makeup candidates use actual dated sessions and saved rosters after transfers and exclude closures',()=>{
 const data={students:[{id:'A',englishName:'Athlete',studentStatus:'Active',registrationDate:'2026-01-01'}],classes:[{id:1,name:'Current timetable name',daysOfWeek:['Monday'],startTime:'08:00',endTime:'09:00',branchId:1}],enrollments:[],attendance:[],makeups:[],occurrences:[{id:'occurrence',class_id:1,class_name:'Saved class',source_date:'2026-10-19',starts_at:'2026-10-20T01:00:00Z',ends_at:'2026-10-20T02:00:00Z',status:'scheduled'}],roster:[{occurrence_id:'occurrence',student_id:'A'}]};const now=new Date('2026-10-25T03:00:00Z');
 const rows=makeupCandidates(data,'2026-10-19','2026-10-25',now);assert.equal(rows.length,1);assert.equal(rows[0].sourceDate,'2026-10-20');assert.equal(rows[0].className,'Saved class');assert.equal(makeupCandidates({...data,occurrences:[{...data.occurrences[0],status:'cancelled'}]},'2026-10-19','2026-10-25',now).length,0);
 assert.equal(makeupCandidates({...data,occurrences:[],enrollments:[{studentId:'A',classId:1,enrollmentDate:'2026-01-01'}],holidays:[{start_date:'2026-10-19',end_date:'2026-10-19',branch_id:1}]},'2026-10-19','2026-10-19',now).length,0);
});
test('administrator assurance requires a verified second-factor token and explicit partial collections remain visible',()=>{
 const token=aal=>'e30.'+Buffer.from(JSON.stringify({aal})).toString('base64url')+'.fixture';for(const role of ['Root','Super Root','Admin']){assert.equal(needsAdministratorMfa(role,token('aal1')),true);assert.equal(needsAdministratorMfa(role,token('aal2')),false);assert.equal(needsAdministratorMfa(role,'invalid'),true);}assert.equal(needsAdministratorMfa('Coach',token('aal1')),false);
 assert.equal(tuitionCollectionStats([{status:'Paid',amountUsd:45},{status:'Pending',amountUsd:10,verifiedCollection:true},{status:'Pending',amountUsd:100}]).totalCollected,55);
});
test('monthly finance preserves invoice balances, separates credits from cash and handles full versus partial pauses',()=>{
 const {tuitionCycle}=loadTs('lib/tuition-cycle.ts');const student={id:'A',registrationDate:'2026-01-15',scholarshipId:1};const standard={id:1,typeName:'Standard',discountPercentage:0};
 const credited={...student,billingInvoices:[{cycleMonth:'2026-10-01',amount:45,balance:0,waiver:0}]};const credit=tuitionCycle(credited,'2026-10',{status:'Paid',amountUsd:10},standard,[],{standardTuitionUsd:60});assert.equal(credit.amount,45);assert.equal(credit.cash,10);assert.equal(credit.balance,0);assert.equal(credit.waived,false);
 const partial=tuitionCycle({...credited,billingInvoices:[{cycleMonth:'2026-10-01',amount:45,balance:35}]},'2026-10',{status:'Pending',verifiedCollection:true,amountUsd:10},{...standard,discountPercentage:100},[],{standardTuitionUsd:60});assert.equal(partial.amount,45);assert.equal(partial.balance,35);assert.equal(partial.cash,10);assert.equal(partial.settled,false);
 const paused={...student,membershipPauses:[{startDate:'2026-10-15',resumeDate:'2026-11-15'}]};assert.equal(tuitionCycle(paused,'2026-10',undefined,standard,[]).balance,0);assert.equal(tuitionCycle({...paused,membershipPauses:[{startDate:'2026-10-16',resumeDate:'2026-11-15'}]},'2026-10',undefined,standard,[]).balance,45);
 const paid=tuitionCycle(paused,'2026-10',{status:'Paid',amountUsd:30},standard,[],{standardTuitionUsd:60});assert.equal(paid.amount,30);assert.equal(paid.cash,30);assert.equal(paid.waived,false);
});
