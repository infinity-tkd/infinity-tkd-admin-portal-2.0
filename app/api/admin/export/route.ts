import {NextResponse} from 'next/server';
import {verifyCaller,formatServerErrorResponse} from '@/lib/backend-security';
import {fetchAllRows} from '@/lib/data-access';
const tables=['profiles','members','member_addresses','students','student_addresses','branches','class_sessions','class_enrollments','attendance','scholarships','belts','belt_histories','achievements','payments','payment_transactions','products','product_variants','product_categories','pos_orders','pos_order_items','inventory_logs','households','household_students','household_payment_batches','partners','staff_dan_history','academy_profile','role_permissions','user_permissions','audit_logs','curriculum','library_assets','library_asset_muscles','muscles','biomechanical_skill_linkage','belt_techniques','lms_progress','workout_templates','student_physical_evaluations','student_body_compositions','student_training_plans'];
export async function GET(req:Request){
 try{
 const {adminSupabase,errorResponse}=await verifyCaller(req,['Root','Super Root']);
 if(errorResponse || !adminSupabase)return errorResponse!;
 const data:Record<string,unknown>={};
 // Limit concurrent reads and fail the entire export if a source is missing.
 for(let i=0;i<tables.length;i+=4){
 const results=await Promise.all(tables.slice(i,i+4).map(async table=>{
 const {data:rows,error}=await fetchAllRows(adminSupabase.from(table).select('*'));
 if(error)throw error;return {table,rows};
 }));
 for(const {table,rows} of results)data[table]=rows;
 }
 return NextResponse.json({format:'infinity-tkd-application-export-v1',exportedAt:new Date().toISOString(),scope:'Application table data. Auth credentials and Storage files require provider backups. Reads are not a database transaction snapshot.',tables:data},{headers:{'Cache-Control':'no-store','Content-Disposition':'attachment; filename="infinity-tkd-application-data.json"'}});
 }catch(e){return formatServerErrorResponse(e);}
}
