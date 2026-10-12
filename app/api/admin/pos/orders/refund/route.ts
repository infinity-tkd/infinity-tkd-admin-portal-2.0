import { NextResponse } from 'next/server';
import { z } from 'zod';
import {verifyCaller,validateRequestBody,formatServerErrorResponse,callerHasPermission} from '@/lib/backend-security';
const schema=z.object({orderId:z.string().uuid(),reference:z.string().trim().min(3).max(150),reason:z.string().trim().min(3).max(500),restock:z.boolean().default(false)}).strict();
export async function POST(req:Request){
 try{
 const {context,adminSupabase,errorResponse}=await verifyCaller(req,['Root','Super Root','Admin']);
 if(errorResponse || !context || !adminSupabase)return errorResponse!;
 if(!await callerHasPermission(adminSupabase,context,'action:pos_cancel_order'))return NextResponse.json({success:false,error:{message:'Permission denied'}},{status:403});
 const {data,errorResponse:invalid}=await validateRequestBody(schema,req);if(invalid || !data)return invalid!;
 const {data:result,error}=await adminSupabase.rpc('portal_refund_order',{p_actor:context.userId,p_order_id:data.orderId,p_reference:data.reference,p_reason:data.reason,p_restock:data.restock});
 if(error)return formatServerErrorResponse(error);return NextResponse.json({success:true,data:result});
 }catch(e){return formatServerErrorResponse(e);}
}
