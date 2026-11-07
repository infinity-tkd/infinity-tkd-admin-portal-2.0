import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCaller, validateRequestBody, callerHasPermission } from '@/lib/backend-security';
import { featureError } from '@/lib/operations-server';
import { isCalendarDate } from '@/lib/dates';
const schema=z.object({studentId:z.string().min(1).max(20),day:z.number().int().min(1).max(31),effectiveMonth:z.string().refine(value=>isCalendarDate(value)&&value.endsWith('-01'),'Choose a billing month'),reason:z.string().trim().min(5).max(500),expectedVersion:z.string().max(40),requestKey:z.string().uuid()}).strict();
export async function POST(req:Request){try{
 const {context,adminSupabase,errorResponse}=await verifyCaller(req,['Root','Super Root','Admin']);if(errorResponse||!context||!adminSupabase)return errorResponse!;
 if(!await callerHasPermission(adminSupabase,context,'action:finance_record_payment'))return NextResponse.json({success:false,error:{message:'Billing administration permission is required.'}},{status:403});
 const {data,errorResponse:invalid}=await validateRequestBody(schema,req);if(invalid||!data)return invalid!;
 const result=await adminSupabase.rpc('portal_change_billing_schedule',{p_actor:context.userId,p_student_id:data.studentId,p_day:data.day,p_effective_month:data.effectiveMonth,p_reason:data.reason,p_expected_version:data.expectedVersion,p_request_key:data.requestKey}).abortSignal(AbortSignal.timeout(15000));
 if(result.error)throw result.error;return NextResponse.json({success:true,data:result.data},{headers:{'Cache-Control':'no-store'}});
}catch(error){return featureError(error);}}
