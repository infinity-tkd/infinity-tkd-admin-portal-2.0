import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCaller,validateRequestBody,formatServerErrorResponse } from '@/lib/backend-security';
const schema=z.object({
 householdId:z.string().uuid(),requestKey:z.string().uuid(),method:z.enum(['Cash','Bank Transfer','Credit Card','ABA Bank KHQR']),
 reference:z.string().trim().max(100).optional(),
 entries:z.array(z.object({studentId:z.string().min(1).max(20),year:z.number().int().min(2000).max(2200),month:z.enum(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']),amount:z.number().positive().max(100000).refine(n=>Math.abs(n*100-Math.round(n*100))<0.00001,'Use two decimal places')}).strict()).min(1).max(50)
}).strict();
export async function POST(req:Request){
 try{
  const {context,adminSupabase,errorResponse}=await verifyCaller(req,['Root','Super Root','Admin','Head Coach','Coach','Assistant Coach']);
  if(errorResponse||!context||!adminSupabase)return errorResponse!;
  const {data,errorResponse:invalid}=await validateRequestBody(schema,req);if(invalid||!data)return invalid!;
  if(new Set(data.entries.map(e=>e.studentId)).size!==data.entries.length)return NextResponse.json({success:false,error:{message:'Choose one month per student.'}},{status:422});
  if(data.method!=='Cash'&&(!data.reference||data.reference.length<3))return NextResponse.json({success:false,error:{message:'Enter the verified bank or card payment reference.'}},{status:422});
  const {data:result,error}=await adminSupabase.rpc('portal_record_household_payment',{p_actor:context.userId,p_household:data.householdId,p_entries:data.entries,p_method:data.method,p_reference:data.reference||null,p_request_key:data.requestKey});
  if(error)return formatServerErrorResponse(error);
  if(!result?.receipt_number||!Array.isArray(result.transactions))throw new Error('Family payment was not confirmed.');
  return NextResponse.json({success:true,data:result},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return formatServerErrorResponse(error);}
}
