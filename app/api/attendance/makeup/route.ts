import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCaller, validateRequestBody, callerHasPermission } from '@/lib/backend-security';
import { featureError, loadMakeupData, ownedStudentIds } from '@/lib/operations-server';
import { academyDate, addCalendarDays, isCalendarDate, daysBetween } from '@/lib/dates';
import { makeupCandidates } from '@/lib/makeup';
const roles=['Root','Super Root','Admin','Head Coach','Coach','Assistant Coach','Student'];
const date=z.string().refine(isCalendarDate,'Choose a valid date');
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('record'),studentId:z.string().min(1).max(20),sourceClassId:z.number().int().positive(),sourceDate:date,attendedDate:date,targetClassId:z.number().int().positive().nullable(),status:z.enum(['Present','Late']),reason:z.string().trim().min(5).max(500),requestKey:z.string().uuid()}).strict(),
 z.object({action:z.literal('void'),id:z.string().uuid(),reason:z.string().trim().min(5).max(500)}).strict(),
]);
export async function GET(req:Request){try{
 const {context,adminSupabase,errorResponse}=await verifyCaller(req,roles);if(errorResponse||!context||!adminSupabase)return errorResponse!;
 const params=new URL(req.url).searchParams,today=academyDate();const from=params.get('from')||addCalendarDays(today,-30),to=params.get('to')||today;
 if(!isCalendarDate(from)||!isCalendarDate(to)||from>to||daysBetween(from,to)>93)return NextResponse.json({success:false,error:{message:'Choose a date range of up to 93 days.'}},{status:400});
 let studentId=params.get('studentId')||undefined;
 if(context.role==='Student'){const ids=await ownedStudentIds(adminSupabase,context.userId);if(!ids.length||studentId&&!ids.includes(studentId))return NextResponse.json({success:false,error:{message:'Student record is not available.'}},{status:403});studentId=studentId??ids[0];}
 else if(!await callerHasPermission(adminSupabase,context,'page:attendance'))return NextResponse.json({success:false,error:{message:'Attendance access is required.'}},{status:403});
 const data=await loadMakeupData(adminSupabase,from,to,studentId);
 return NextResponse.json({success:true,data:{candidates:makeupCandidates(data,from,to),records:data.makeups,classes:data.classes}},{headers:{'Cache-Control':'no-store'}});
}catch(error){return featureError(error);}}
export async function POST(req:Request){try{
 const {context,adminSupabase,errorResponse}=await verifyCaller(req,roles.filter(role=>role!=='Student'));if(errorResponse||!context||!adminSupabase)return errorResponse!;
 const {data,errorResponse:invalid}=await validateRequestBody(schema,req);if(invalid||!data)return invalid!;
 const permission=data.action==='void'?'action:attendance_delete':'action:attendance_mark';if(!await callerHasPermission(adminSupabase,context,permission))return NextResponse.json({success:false,error:{message:'Attendance permission is required.'}},{status:403});
 const result=data.action==='void'?await adminSupabase.rpc('portal_void_makeup',{p_actor:context.userId,p_id:data.id,p_reason:data.reason}):await adminSupabase.rpc('portal_record_makeup',{p_actor:context.userId,p_student_id:data.studentId,p_source_class:data.sourceClassId,p_source_date:data.sourceDate,p_attended_date:data.attendedDate,p_target_class:data.targetClassId,p_status:data.status,p_reason:data.reason,p_request_key:data.requestKey});
 if(result.error)throw result.error;return NextResponse.json({success:true,data:result.data},{headers:{'Cache-Control':'no-store'}});
}catch(error){return featureError(error);}}
