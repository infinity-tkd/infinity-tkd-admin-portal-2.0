import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCaller,validateRequestBody,formatServerErrorResponse,callerHasPermission } from '@/lib/backend-security';
import { fetchAllRows } from '@/lib/data-access';
export async function GET(req:Request) {
 try {
  const {context,adminSupabase,errorResponse}=await verifyCaller(req,['Root','Super Root','Admin','Head Coach','Coach','Assistant Coach']);
  if(errorResponse || !adminSupabase || !context)return errorResponse!;
  if(!await callerHasPermission(adminSupabase,context,'page:directory') && !await callerHasPermission(adminSupabase,context,'page:financials'))return NextResponse.json({success:false,error:{message:'Permission denied.'}},{status:403});
  const {data,error}=await fetchAllRows(adminSupabase.from('households').select('*,students:household_students(student_id)'));
  if(error)return formatServerErrorResponse(error);
  return NextResponse.json({success:true,data:data?.map(h=>({id:h.id,guardianName:h.guardian_name,guardianPhone:h.guardian_phone,guardianEmail:h.guardian_email,studentIds:h.students.map((s:any)=>s.student_id)}))},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return formatServerErrorResponse(e);}
}
const schema=z.object({id:z.string().uuid().optional(),guardianName:z.string().trim().min(1).max(150),guardianPhone:z.string().trim().min(1).max(50),guardianEmail:z.string().email().or(z.literal('')),studentIds:z.array(z.string().min(1).max(20)).max(50)}).strict();
export async function POST(req:Request) {
 try {
  const {context,adminSupabase,errorResponse}=await verifyCaller(req,['Root','Super Root','Admin','Head Coach','Coach','Assistant Coach']);
  if(errorResponse || !adminSupabase || !context)return errorResponse!;
  if(!await callerHasPermission(adminSupabase,context,'action:student_edit'))return NextResponse.json({success:false,error:{message:'Permission denied.'}},{status:403});
  const {data,errorResponse:invalid}=await validateRequestBody(schema,req);if(invalid || !data)return invalid!;
  const {data:result,error}=await adminSupabase.rpc('portal_save_household',{p_actor:context.userId,p_payload:data});
  if(error)return formatServerErrorResponse(error);
  return NextResponse.json({success:true,data:result});
 }catch(e){return formatServerErrorResponse(e);}
}
