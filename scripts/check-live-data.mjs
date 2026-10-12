import {liveSnapshot} from './lib/live-snapshot.mjs';
const {datasets,summaries,ms} = await liveSnapshot();
const validNumber=value=>Number.isFinite(Number(value));
const issues=[];
const check=(name,rows,invalid)=>{const count=rows.filter(invalid).length;if(count)issues.push({dataset:name,invalidRows:count});};
check('students',datasets.students,row=>!row.id||!row.english_name||!row.khmer_name||!row.dob);
check('payments',datasets.payments,row=>!validNumber(row.amount_usd)||Number(row.amount_usd)<0||!['Paid','Unpaid','Pending','Waived'].includes(row.status));
check('class_sessions',datasets.class_sessions,row=>!row.start_time||!row.end_time||row.start_time>=row.end_time||Number(row.capacity)<1);
check('partners',datasets.partners,row=>!row.name);
const legacyPaidDates=datasets.payments.filter(row=>row.status==='Paid'&&!row.payment_date).length;
const paidTotal=datasets.payments.filter(row=>row.status==='Paid').reduce((sum,row)=>sum+Number(row.amount_usd),0);
console.log(JSON.stringify({scope:'real REST data; service-role reads, no writes and no row output',datasets:summaries,totalMs:ms,
 bytes:summaries.reduce((sum,item)=>sum+item.bytes,0),paidTotal,legacyPaidDates,issues,passed:issues.length===0},null,2));
if(issues.length)process.exitCode=1;
