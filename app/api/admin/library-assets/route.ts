import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCaller,validateRequestBody,formatServerErrorResponse } from '@/lib/backend-security';
const asset=z.object({
 title:z.string().trim().min(1).max(150),description:z.string().max(100000),library_type:z.enum(['Fitness','Taekwondo']),
 tkd_category:z.string().max(50).nullable(),fitness_category:z.string().max(100).nullable(),target_level:z.string().trim().min(1).max(50),
 video_url:z.string().max(255),muscleRelations:z.array(z.object({muscleId:z.number().int().positive(),role:z.enum(['Primary','Secondary'])}).strict()).max(100).optional()
}).strict();
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('CREATE'),requestKey:z.string().uuid(),asset}).strict(),
 z.object({action:z.literal('UPDATE'),id:z.number().int().positive(),asset}).strict(),
 z.object({action:z.literal('DELETE'),id:z.number().int().positive()}).strict()
]);
export async function POST(req:Request){
 try {
  const {context,adminSupabase,errorResponse}=await verifyCaller(req,['Root','Super Root','Admin','Head Coach','Coach','Assistant Coach']);
  if(errorResponse||!context||!adminSupabase)return errorResponse!;
  const {data,errorResponse:invalid}=await validateRequestBody(schema,req);if(invalid||!data)return invalid!;
  if(data.action!=='DELETE'&&data.asset.muscleRelations&&new Set(data.asset.muscleRelations.map(r=>r.muscleId)).size!==data.asset.muscleRelations.length)return NextResponse.json({error:{message:'Each muscle may be linked only once.'}},{status:422});
  const {data:result,error}=await adminSupabase.rpc('portal_save_library_asset',{p_actor:context.userId,p_action:data.action,p_id:data.action==='CREATE'?null:data.id,p_payload:data.action==='DELETE'?{}:data.asset,p_request_key:data.action==='CREATE'?data.requestKey:null});
  if(error)return formatServerErrorResponse(error);
  if(!result||(data.action==='DELETE'?!result.deleted:!result.asset))throw new Error('Library save was not confirmed.');
  return NextResponse.json({success:true,data:result},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return formatServerErrorResponse(error);}
}
