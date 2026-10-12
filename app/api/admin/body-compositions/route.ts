import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCaller, validateRequestBody, formatServerErrorResponse } from '@/lib/backend-security';
import { academyDate,isCalendarDate } from '@/lib/dates';
const optionalMeasure=z.number().finite().min(0).max(500).nullable().optional();
const schema=z.object({requestKey:z.string().uuid(),measurement:z.object({
 student_id:z.string().min(1).max(20),recorded_date:z.string().refine(isCalendarDate,'Invalid date').refine(d=>d>='1900-01-01'&&d<=academyDate(),'Measurement date cannot be in the future'),
 height_cm:z.number().finite().positive().max(300),weight_kg:z.number().finite().positive().max(600),
 body_fat_percentage:z.number().finite().min(0).max(100).nullable().optional(),skeletal_muscle_mass_kg:optionalMeasure,
 neck_cm:optionalMeasure,shoulder_width_cm:optionalMeasure,chest_cm:optionalMeasure,waist_cm:optionalMeasure,hips_cm:optionalMeasure,
 left_arm_cm:optionalMeasure,right_arm_cm:optionalMeasure,left_thigh_cm:optionalMeasure,right_thigh_cm:optionalMeasure,left_calf_cm:optionalMeasure,right_calf_cm:optionalMeasure
}).strict()}).strict();
export async function POST(req:Request){
 try{
  const {context,adminSupabase,errorResponse}=await verifyCaller(req,['Root','Super Root','Admin','Head Coach','Coach','Assistant Coach']);
  if(errorResponse||!context||!adminSupabase)return errorResponse!;
  const {data,errorResponse:invalid}=await validateRequestBody(schema,req);if(invalid||!data)return invalid!;
  const {data:result,error}=await adminSupabase.rpc('portal_record_body_composition',{p_actor:context.userId,p_payload:data.measurement,p_request_key:data.requestKey});
  if(error)return formatServerErrorResponse(error);
  if(!result?.measurement||!result?.latest)throw new Error('Measurement save was not confirmed.');
  return NextResponse.json({success:true,data:result},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return formatServerErrorResponse(error);}
}
