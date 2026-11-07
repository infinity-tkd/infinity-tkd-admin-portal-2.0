import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';

const {hasPermission,PERMISSION_DEFINITIONS,permissionDependencies,canWriteModule}=loadTs('lib/permissions.ts');
const {canAccessRoute}=loadTs('lib/security.ts');
const {portalLoadPlan,portalDeniedDatasets,portalStudentSelect}=loadTs('lib/portal-load-plan.ts');
const {dataLoadIssue,preserveUnavailableData,restrictPortalData}=loadTs('lib/data-load-status.ts');
const user='fixture-account';

test('factory role matrix distinguishes staff powers and never turns student discretionary grants into staff actions',()=>{
 const financeRoles=['Root','Super Root','Admin'];
 const calendarCreators=['Root','Super Root','Admin','Head Coach'];
 const attendanceWriters=['Root','Super Root','Admin','Head Coach','Coach','Assistant Coach'];
 for(const role of [...attendanceWriters,'Student']){
  assert.equal(hasPermission(role,'page:financials'),financeRoles.includes(role),role+' financial read');
  assert.equal(hasPermission(role,'action:events_create'),calendarCreators.includes(role),role+' event create');
  assert.equal(hasPermission(role,'action:events_publish'),financeRoles.includes(role),role+' publish');
  assert.equal(hasPermission(role,'action:attendance_mark'),attendanceWriters.includes(role),role+' attendance');
 }
 for(const permission of PERMISSION_DEFINITIONS.filter(row=>row.accessType==='write').map(row=>row.key)){
  assert.equal(hasPermission('Student',permission,{'Student:page:staff':true,'Student:page:settings':true,'Student:page:directory':true},user,{[`${user}:${permission}`]:true}),false,permission);
 }
 assert.equal(hasPermission('Unknown','page:financials',{'Unknown:page:financials':true}),false);
 assert.equal(hasPermission('__proto__','page:financials'),false);
});

test('account overrides precede role overrides while action grants cannot bypass a denied parent module',()=>{
 const role={'Coach:action:attendance_mark':false};
 assert.equal(hasPermission('Coach','action:attendance_mark',role,user,{[user+':action:attendance_mark']:true}),true);
 assert.equal(hasPermission('Coach','action:attendance_mark',{},user,{[user+':action:attendance_mark']:false}),false);
 assert.equal(hasPermission('Admin','action:finance_record_payment',{'Admin:page:financials':false}),false);
 assert.equal(hasPermission('Admin','manage:finances',{'Admin:action:finance_record_payment':false}),false,'a granted legacy alias cannot bypass a canonical action denial');
 assert.equal(hasPermission('Coach','action:curriculum_edit',{'Coach:page:lms':false,'Coach:page:library':true}),true,'shared curriculum action can use its other authorized module');
 assert.equal(hasPermission('Coach','action:curriculum_edit',{'Coach:page:lms':false,'Coach:page:library':false}),false);
 assert.deepEqual(permissionDependencies('action:finance_record_payment'),['action:finance_record_payment','page:financials']);
 assert.ok(permissionDependencies('grade:evaluations').includes('action:evaluations_grade'));
 assert.equal(canWriteModule('financials',key=>key==='action:finance_record_payment'),false,'module writers must also have module read access');
 assert.equal(canWriteModule('financials',()=>true,'action:staff_manage'),false,'an unrelated action is not financial write authority');
 assert.equal(hasPermission('Root','action:finance_record_payment',{'Root:page:financials':false},user,{[user+':action:finance_record_payment']:false}),true,'documented owner authority remains unconditional');
});

test('admin route checks use page permissions, account denials and a staff boundary rather than legacy aliases',()=>{
 assert.equal(canAccessRoute('Admin','/financials',{'Admin:page:financials':false}),false);
 assert.equal(canAccessRoute('Coach','/students'),true,'directory read does not require student edit');
 assert.equal(canAccessRoute('Coach','/students',{},user,{[user+':page:directory']:false}),false);
 assert.equal(canAccessRoute('Student','/students'),false);
 assert.equal(canAccessRoute('Student','/lms'),false,'student learning is served by the separate student portal');
 assert.equal(canAccessRoute('Coach','/calendar-other'),false,'unknown adjacent paths do not inherit calendar access');
 assert.equal(canAccessRoute('Assistant Coach','/schedule'),true,'schedule read does not require a write alias');
});

test('route data plans do not pull unrelated private records or financial datasets for a non-financial role',()=>{
 const coach=key=>hasPermission('Coach',key);
 for(const path of ['/calendar','/unknown','/profile']){
  const plan=portalLoadPlan(path,coach);
  for(const dataset of ['students','attendance','payments','payment_transactions','membership_invoices','muscles','partners','members'])assert.equal(plan.has(dataset),false,path+' '+dataset);
 }
 const dashboard=portalLoadPlan('/dashboard',coach);
 assert.equal(dashboard.has('students'),true);
 for(const dataset of ['payments','payment_transactions','membership_invoices','members'])assert.equal(dashboard.has(dataset),false,dataset);
 assert.equal(portalLoadPlan('/financials',coach).has('students'),false,'a forbidden deep link does not load that page\'s business dependencies');
 assert.equal(portalLoadPlan('/financials',key=>hasPermission('Admin',key)).has('payment_transactions'),true);
 assert.equal(portalLoadPlan('/financials',key=>key==='page:financials').has('class_sessions'),true,'a finance-only grant retains class labels used by billing');
 assert.ok(portalDeniedDatasets(coach).includes('payments'));
});

test('permission and session denial remove cached records; temporary read failures alone retain a labeled cache',()=>{
 const old={students:[{id:'student',billingInvoices:[{balance:45}],membershipPauses:[{startDate:'2026-01-01'}]}],payments:[{id:'paid',receiptNumber:'PRIVATE'}],users:[{id:'staff',displayName:'Coach',role:'Coach',isActive:true,email:'PRIVATE',medicalNotes:'PRIVATE'}]};
 const incoming={students:[],payments:[],users:[]};
 assert.deepEqual(preserveUnavailableData(old,incoming,[dataLoadIssue('payments',{code:'42501'})]).payments,[]);
 assert.deepEqual(preserveUnavailableData(old,incoming,[dataLoadIssue('students',{code:'PGRST301'})]).students,[]);
 assert.equal(preserveUnavailableData(old,incoming,[dataLoadIssue('payments',{})]).payments,old.payments);
 assert.deepEqual(preserveUnavailableData(old,incoming,[],['payments'],['payments']).payments,[],'unrequested must not restore records after a grant is revoked');
 const restricted=restrictPortalData(old,['members','membership_invoices']);
 assert.deepEqual(restricted.users,[{id:'staff',displayName:'Coach',role:'Coach',isActive:true}]);
 assert.equal(restricted.students[0].billingInvoices,undefined);
 assert.deepEqual(restricted.students[0].membershipPauses,old.students[0].membershipPauses);
 assert.equal(JSON.stringify(restricted.users).includes('PRIVATE'),false);
});

test('non-directory reads and grant-revoked caches omit medical, guardian and address details while retaining needed contacts',()=>{
 const privateStudent={id:'student',englishName:'Fixture student',dob:'2010-01-01',medicalNotes:'PRIVATE',allergies:'PRIVATE',emergencyContactPhone:'PRIVATE',address:{line1:'PRIVATE'},esignPath:'PRIVATE',notes:'PRIVATE',heightCm:160,email:'finance@example.test',phone:'012345678',telegramUsername:'fixture'};
 const finance=key=>key==='page:financials';
 const attendance=key=>key==='page:attendance';
 for(const can of [finance,attendance]){
  const selection=portalStudentSelect(can);
  for(const field of ['medical_notes','allergies','emergency_contact_phone','student_addresses','esign_path'])assert.equal(selection.includes(field),false);
  const filtered=restrictPortalData({students:[privateStudent]},portalDeniedDatasets(can)).students[0];
  assert.equal(JSON.stringify(filtered).includes('PRIVATE'),false);
  assert.equal(filtered.dob,privateStudent.dob,'belt age rules retain their required input');
  assert.equal(filtered.email,can===finance?privateStudent.email:undefined);
 }
 assert.equal(portalStudentSelect(key=>key==='page:directory'),'*, student_addresses(*)');
});

test('Settings-only account managers retain editor fields while staff dossier and address details are removed',()=>{
 const grants={'Admin:page:staff':false,'Admin:page:settings':true,'Admin:action:staff_manage':true};
 const can=key=>hasPermission('Admin',key,grants);
 const denied=portalDeniedDatasets(can);
 assert.equal(can('action:staff_manage'),true,'Settings remains an intentional alternative parent');
 assert.ok(denied.includes('members'),'Settings management must not read full staff member rows');
 assert.equal(portalLoadPlan('/settings',can).has('members'),false);
 assert.equal(portalLoadPlan('/settings',can).has('staff_dan_history'),false,'Settings account management does not need martial certificates');
 const account={id:'account',username:'fixture_coach',email:'fixture@example.test',displayName:'Fixture coach',role:'Coach',isActive:true,studentId:'STU-M-1',khmerName:'Fixture Khmer',phone:'012345678',profilePicturePath:'/fixture.png',medicalNotes:'PRIVATE',allergies:'PRIVATE',danCertificateUrl:'PRIVATE',address:{line1:'PRIVATE'}};
 const retained=restrictPortalData({users:[account]},denied,can('page:settings')&&can('action:staff_manage')).users[0];
 assert.equal(retained.username,account.username);assert.equal(retained.email,account.email);assert.equal(retained.phone,account.phone);assert.equal(retained.studentId,account.studentId);
 assert.equal(JSON.stringify(retained).includes('PRIVATE'),false);
 const revoked=restrictPortalData({users:[account]},denied,false).users[0];
 assert.equal(revoked.username,undefined);assert.equal(revoked.email,undefined);assert.equal(revoked.phone,undefined);
});

test('a skipped member read preserves fresh account summaries and staff labels on the initial load',()=>{
 const summary={id:'account',username:'fixture_student',email:'fixture@example.test',displayName:'Fixture student',role:'Student',isActive:true,studentId:'STU-M-1',phone:'012345678'};
 const first=preserveUnavailableData({users:[]},{users:[summary]},[],['members'],['members'],true);
 assert.deepEqual(first.users,[summary],'first-load account rows must not be overwritten with the empty member cache');
 const label={id:'coach',displayName:'Fixture coach',role:'Coach',isActive:true};
 assert.deepEqual(preserveUnavailableData({users:[]},{users:[label]},[],['members'],['members']).users,[label]);
 const stale={...summary,username:'old_name',phone:'OLD',medicalNotes:'PRIVATE',address:{line1:'PRIVATE'}};
 const refresh=preserveUnavailableData({users:[stale]},{users:[summary]},[],['members'],['members'],true);
 assert.deepEqual(refresh.users,[summary],'fresh identity and projected phone must win over prior dossier details');
 assert.equal(JSON.stringify(refresh).includes('PRIVATE'),false);
});

test('a temporary member outage preserves only matching member fields without losing fresh profile identity or new users',()=>{
 const old={id:'coach',username:'old_name',email:'old@example.test',displayName:'Old name',role:'Coach',isActive:true,phone:'012345678',medicalNotes:'Cached private member note'};
 const fresh={id:'coach',username:'new_name',email:'new@example.test',displayName:'Current name',role:'Head Coach',isActive:false,phone:'',medicalNotes:''};
 const added={id:'new_coach',username:'new_coach',displayName:'New account',role:'Coach',isActive:true};
 const temporary=[dataLoadIssue('members',{code:'08006'})];
 const retained=preserveUnavailableData({users:[old]},{users:[fresh,added]},temporary);
 assert.equal(retained.users.length,2);assert.equal(retained.users[0].username,'new_name');assert.equal(retained.users[0].role,'Head Coach');assert.equal(retained.users[0].isActive,false);
 assert.equal(retained.users[0].phone,old.phone);assert.equal(retained.users[0].medicalNotes,old.medicalNotes);assert.deepEqual(retained.users[1],added);
 const revoked=preserveUnavailableData({users:[old]},{users:[fresh,added]},temporary,[],['members']);
 assert.deepEqual(revoked.users[0],{id:'coach',displayName:'Current name',role:'Head Coach',isActive:false});
 assert.equal(JSON.stringify(revoked).includes('Cached private'),false);
});
