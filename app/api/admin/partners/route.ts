import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isCalendarDate } from '@/lib/dates';
import { fetchAllRows } from '@/lib/data-access';
import { partnerField } from '@/lib/partners';
import { 
  verifyCaller, 
  validateRequestBody, 
  sanitizeString, 
  logSecurityAuditEvent, 
  formatServerErrorResponse
} from '@/lib/backend-security';

const PartnerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(255),
  brandName: z.string().max(255).optional().nullable(),
  logoUrl: z.string().max(500).optional().nullable(),
  partnerType: z.enum([
    'MOU',
    'Sponsor',
    'Educational',
    'Supplier',
    'Affiliated Dojang',
    'Media & Marketing',
    'Federation',
    'Healthcare',
    'Government/NGO',
    'Other'
  ]).default('MOU'),
  status: z.enum([
    'Active',
    'Pending Discussion',
    'MOU Signed',
    'Under Renewal',
    'Expired',
    'Terminated'
  ]).default('Active'),
  description: z.string().max(2000).optional().nullable(),
  collaborationScope: z.string().max(2000).optional().nullable(),
  benefitsSummary: z.string().max(2000).optional().nullable(),
  founderName: z.string().max(150).optional().nullable(),
  founderContact: z.string().max(150).optional().nullable(),
  contactName: z.string().max(150).optional().nullable(),
  contactRole: z.string().max(150).optional().nullable(),
  email: z.string().email('Invalid email address').max(255).optional().nullable().or(z.literal('')),
  phone: z.string().max(100).optional().nullable(),
  telegramUsername: z.string().max(100).optional().nullable(),
  telegramLink: z.string().max(500).optional().nullable(),
  secondaryContactName: z.string().max(150).optional().nullable(),
  secondaryContactPhone: z.string().max(100).optional().nullable(),
  secondaryContactTelegram: z.string().max(100).optional().nullable(),
  websiteUrl: z.string().max(500).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  country: z.string().max(100).default('Cambodia'),
  mouSignedDate: z.string().refine(isCalendarDate, 'Invalid signed date').optional().nullable().or(z.literal('')),
  mouExpiryDate: z.string().refine(isCalendarDate, 'Invalid expiry date').optional().nullable().or(z.literal('')),
  contractDocumentUrl: z.string().max(500).optional().nullable(),
  notes: z.string().max(3000).optional().nullable(),
  tags: z.array(z.string().max(50)).max(50).optional().default([])
});

const IS_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UpdatePartnerSchema = PartnerSchema.partial().extend({
  id: z.string().uuid('Invalid partner ID')
});

function formatTelegram(username?: string | null, link?: string | null): { cleanUsername?: string; cleanLink?: string } {
  if (!username && !link) return {};
  let cleanUser = username?.trim() || '';
  if (cleanUser.startsWith('@')) {
    cleanUser = cleanUser.substring(1);
  } else if (cleanUser.startsWith('https://t.me/')) {
    cleanUser = cleanUser.replace('https://t.me/', '').replace(/\/$/, '');
  }

  let cleanUrl = link?.trim() || '';
  if (!cleanUrl && cleanUser) {
    cleanUrl = `https://t.me/${cleanUser}`;
  } else if (cleanUrl && !cleanUrl.startsWith('http')) {
    cleanUrl = `https://${cleanUrl}`;
  }

  return {
    cleanUsername: cleanUser || undefined,
    cleanLink: cleanUrl || undefined
  };
}

function normalizePartnerTypeFromDb(type?: string | null): string {
  if (!type) return 'MOU';
  const lower = type.toLowerCase();
  switch (lower) {
    case 'mou': return 'MOU';
    case 'sponsor': return 'Sponsor';
    case 'school':
    case 'university':
    case 'educational': return 'Educational';
    case 'vendor':
    case 'supplier': return 'Supplier';
    case 'affiliated dojang': return 'Affiliated Dojang';
    case 'media':
    case 'media & marketing': return 'Media & Marketing';
    case 'federation': return 'Federation';
    case 'medical':
    case 'healthcare': return 'Healthcare';
    case 'ngo':
    case 'government/ngo': return 'Government/NGO';
    default: return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

function normalizeStatusFromDb(status?: string | null): string {
  if (!status) return 'Active';
  const lower = status.toLowerCase();
  switch (lower) {
    case 'active': return 'Active';
    case 'pending':
    case 'pending discussion':
    case 'pending_discussion': return 'Pending Discussion';
    case 'mou signed':
    case 'mou_signed':
    case 'signed': return 'MOU Signed';
    case 'under renewal':
    case 'under_renewal':
    case 'renewal': return 'Under Renewal';
    case 'expired': return 'Expired';
    case 'terminated': return 'Terminated';
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function normalizePartnerRecord(row: any) {
  if (!row) return row;
  const secondaryContacts = Array.isArray(row.secondary_contacts) ? row.secondary_contacts : [];
  const firstSecondary = secondaryContacts[0] || {};

  return {
    id: row.id,
    name: row.name,
    brand_name: row.brand_name || null,
    logo_url: row.logo_url || null,
    partner_type: normalizePartnerTypeFromDb(row.partner_type),
    status: normalizeStatusFromDb(row.status),
    description: row.description || null,
    collaboration_scope: row.collaboration_scope || null,
    benefits_summary: row.benefits_summary || null,
    founder_name: row.founder_name || null,
    founder_contact: row.founder_contact || null,
    contact_name: partnerField(row,'contactName','contact_name',row.contact_person) || null,
    contact_role: row.contact_role || null,
    email: row.email || null,
    phone: row.phone || null,
    telegram_username: row.telegram_username || null,
    telegram_link: partnerField(row,'telegramLink','telegram_link',row.telegram_url) || null,
    secondary_contact_name: partnerField(row,'secondaryContactName','secondary_contact_name',firstSecondary.name) || null,
    secondary_contact_phone: partnerField(row,'secondaryContactPhone','secondary_contact_phone',firstSecondary.phone) || null,
    secondary_contact_telegram: partnerField(row,'secondaryContactTelegram','secondary_contact_telegram',firstSecondary.telegram) || null,
    website_url: partnerField(row,'websiteUrl','website_url',row.website) || null,
    address: partnerField(row,'address','address',row.city) || null,
    country: row.country || 'Cambodia',
    mou_signed_date: row.mou_signed_date || null,
    mou_expiry_date: row.mou_expiry_date || null,
    contract_document_url: partnerField(row,'contractDocumentUrl','contract_document_url',row.document_url) || null,
    notes: partnerField(row,'notes','notes',row.internal_notes) || null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}


const partnerFields: Record<string,string> = {
 name:'name',brandName:'brand_name',logoUrl:'logo_url',partnerType:'partner_type',status:'status',
 description:'description',collaborationScope:'collaboration_scope',benefitsSummary:'benefits_summary',
 founderName:'founder_name',founderContact:'founder_contact',contactName:'contact_name',contactRole:'contact_role',
 email:'email',phone:'phone',secondaryContactName:'secondary_contact_name',secondaryContactPhone:'secondary_contact_phone',
 secondaryContactTelegram:'secondary_contact_telegram',websiteUrl:'website_url',address:'address',country:'country',
 mouSignedDate:'mou_signed_date',mouExpiryDate:'mou_expiry_date',contractDocumentUrl:'contract_document_url',notes:'notes',tags:'tags'
};
function partnerPayload(body: Record<string,unknown>) {
 const payload: Record<string,unknown> = {};
 for (const [field,column] of Object.entries(partnerFields)) {
  if (body[field] === undefined) continue;
  const value=body[field];
  payload[column]=typeof value==='string' ? sanitizeString(value) || null : value;
 }
 if (body.telegramUsername !== undefined || body.telegramLink !== undefined) {
  const telegram=formatTelegram(body.telegramUsername as string|null,body.telegramLink as string|null);
  payload.telegram_username=telegram.cleanUsername || null;
  payload.telegram_link=telegram.cleanLink || null;
 }
 return payload;
}
export async function GET(req: Request) {
 try {
  const {errorResponse,context,adminSupabase}=await verifyCaller(req,['Root','Super Root','Admin','Head Coach','Coach','Assistant Coach']);
  if(errorResponse || !context || !adminSupabase)return errorResponse!;
  const {data,error}=await fetchAllRows(adminSupabase.from('partners').select('*').order('created_at',{ascending:false}));
  if(error) return formatServerErrorResponse(error);
  return NextResponse.json({success:true,data:(data || []).map(normalizePartnerRecord),error:null});
 } catch(error) { return formatServerErrorResponse(error); }
}
export async function POST(req: Request) {
 try {
  const {errorResponse,context,adminSupabase}=await verifyCaller(req,['Root','Super Root','Admin','Head Coach']);
  if(errorResponse || !context || !adminSupabase)return errorResponse!;
  const {data:body,errorResponse:invalid}=await validateRequestBody(PartnerSchema,req);
  if(invalid || !body)return invalid!;
  const {data,error}=await adminSupabase.from('partners').insert({...partnerPayload(body),created_by:context.userId}).select('*').single();
  if(error || !data)return formatServerErrorResponse(error || new Error('Partner creation was not confirmed.'));
  await logSecurityAuditEvent({action:'PARTNER_CREATED',performedBy:context.userId,targetId:data.id,details:{name:data.name},status:'SUCCESS'});
  return NextResponse.json({success:true,data:normalizePartnerRecord(data),error:null},{status:201});
 } catch(error) { return formatServerErrorResponse(error); }
}
export async function PUT(req: Request) {
 try {
  const {errorResponse,context,adminSupabase}=await verifyCaller(req,['Root','Super Root','Admin','Head Coach']);
  if(errorResponse || !context || !adminSupabase)return errorResponse!;
  const {data:body,errorResponse:invalid}=await validateRequestBody(UpdatePartnerSchema,req);
  if(invalid || !body)return invalid!;
  const {data,error}=await adminSupabase.from('partners').update(partnerPayload(body)).eq('id',body.id).select('*').single();
  if(error || !data)return formatServerErrorResponse(error || new Error('Partner update was not confirmed.'));
  await logSecurityAuditEvent({action:'PARTNER_UPDATED',performedBy:context.userId,targetId:data.id,details:{fields:Object.keys(body)},status:'SUCCESS'});
  return NextResponse.json({success:true,data:normalizePartnerRecord(data),error:null});
 } catch(error) { return formatServerErrorResponse(error); }
}
export async function DELETE(req: Request) {
 try {
  const {errorResponse,context,adminSupabase}=await verifyCaller(req,['Root','Super Root','Admin','Head Coach']);
  if(errorResponse || !context || !adminSupabase)return errorResponse!;
  const id=new URL(req.url).searchParams.get('id');
  if(!id || !IS_UUID_REGEX.test(id))return NextResponse.json({success:false,error:{message:'A valid partner ID is required.'}},{status:400});
  const {data,error}=await adminSupabase.from('partners').delete().eq('id',id).select('id').single();
  if(error || !data)return formatServerErrorResponse(error || new Error('Partner deletion was not confirmed.'));
  await logSecurityAuditEvent({action:'PARTNER_DELETED',performedBy:context.userId,targetId:id,status:'SUCCESS'});
  return NextResponse.json({success:true,data:{id},error:null});
 } catch(error) { return formatServerErrorResponse(error); }
}
