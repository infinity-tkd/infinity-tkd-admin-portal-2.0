import {NextResponse} from 'next/server';
import {verifyCaller,formatServerErrorResponse} from '@/lib/backend-security';
export async function POST(req:Request) {
 const {errorResponse,context,adminSupabase}=await verifyCaller(req,['Root','Super Root','Admin','Head Coach','Coach','Assistant Coach']);
 if(errorResponse || !context || !adminSupabase)return errorResponse!;
 const {data,error}=await adminSupabase.rpc('portal_reconcile_belts',{p_actor:context.userId});
 if(error)return formatServerErrorResponse(error);
 return NextResponse.json({success:true,data});
}
