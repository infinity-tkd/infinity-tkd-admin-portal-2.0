import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCaller,validateRequestBody,formatServerErrorResponse } from '@/lib/backend-security';
const schema=z.object({studentId:z.string().min(1).max(20),assetId:z.number().int().positive(),completed:z.boolean()}).strict();
export async function POST(req:Request){
 try {
  const {context,adminSupabase,errorResponse}=await verifyCaller(req,['Root','Super Root','Admin','Head Coach','Coach','Assistant Coach']);
  if(errorResponse||!context||!adminSupabase)return errorResponse!;
  const {data,errorResponse:invalid}=await validateRequestBody(schema,req);if(invalid||!data)return invalid!;
  const {data:result,error}=await adminSupabase.rpc('portal_set_video_progress',{p_actor:context.userId,p_student:data.studentId,p_asset:data.assetId,p_completed:data.completed});
  if(error)return formatServerErrorResponse(error);
  return NextResponse.json({success:true,data:result},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return formatServerErrorResponse(error);}
}
