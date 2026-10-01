import { NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  verifyCaller, 
  validateRequestBody, 
  sanitizeString, 
  logSecurityAuditEvent, 
  formatServerErrorResponse,
  checkApiRateLimit
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
  mouSignedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Signed date must be YYYY-MM-DD').optional().nullable().or(z.literal('')),
  mouExpiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be YYYY-MM-DD').optional().nullable().or(z.literal('')),
  contractDocumentUrl: z.string().max(500).optional().nullable(),
  notes: z.string().max(3000).optional().nullable(),
  tags: z.array(z.string().max(50)).optional().default([])
});

const IS_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UpdatePartnerSchema = PartnerSchema.partial().extend({
  id: z.string().min(1, 'Partner ID is required')
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

function normalizePartnerTypeToLegacy(type?: string): string {
  switch (type) {
    case 'MOU': return 'mou';
    case 'Sponsor': return 'sponsor';
    case 'Educational': return 'university';
    case 'Supplier': return 'vendor';
    case 'Affiliated Dojang': return 'other';
    case 'Media & Marketing': return 'media';
    case 'Federation': return 'federation';
    case 'Healthcare': return 'medical';
    case 'Government/NGO': return 'ngo';
    default: return 'other';
  }
}

function normalizeStatusToLegacy(status?: string): string {
  switch (status) {
    case 'Expired': return 'expired';
    case 'Terminated': return 'terminated';
    default: return 'active';
  }
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
    contact_name: row.contact_name || row.contact_person || null,
    contact_role: row.contact_role || null,
    email: row.email || null,
    phone: row.phone || null,
    telegram_username: row.telegram_username || null,
    telegram_link: row.telegram_link || row.telegram_url || null,
    secondary_contact_name: row.secondary_contact_name || firstSecondary.name || null,
    secondary_contact_phone: row.secondary_contact_phone || firstSecondary.phone || null,
    secondary_contact_telegram: row.secondary_contact_telegram || firstSecondary.telegram || null,
    website_url: row.website_url || row.website || null,
    address: row.address || row.city || null,
    country: row.country || 'Cambodia',
    mou_signed_date: row.mou_signed_date || null,
    mou_expiry_date: row.mou_expiry_date || null,
    contract_document_url: row.contract_document_url || row.document_url || null,
    notes: row.notes || row.internal_notes || null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * GET: Fetch all partners / MOUs
 */
export async function GET(req: Request) {
  try {
    const { errorResponse, context, adminSupabase } = await verifyCaller(req, [
      'Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'
    ]);
    if (errorResponse || !adminSupabase || !context) return errorResponse!;

    const { data: partners, error } = await adminSupabase
      .from('partners')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ success: true, data: [], error: null });
      }
      return NextResponse.json(
        { success: false, data: null, error: { code: error.code || 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    const normalized = (partners || []).map(normalizePartnerRecord);
    return NextResponse.json({ success: true, data: normalized, error: null });
  } catch (err: any) {
    return formatServerErrorResponse(err);
  }
}

/**
 * POST: Create a new partner / MOU entry
 */
export async function POST(req: Request) {
  try {
    const { errorResponse, context, adminSupabase } = await verifyCaller(req, [
      'Root', 'Super Root', 'Admin', 'Head Coach'
    ]);
    if (errorResponse || !adminSupabase || !context) return errorResponse!;

    const rateLimit = checkApiRateLimit(`partner_post_${context.userId}`, 20, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please slow down.' } },
        { status: 429 }
      );
    }

    const { data: body, errorResponse: parseError } = await validateRequestBody(PartnerSchema, req);
    if (parseError || !body) return parseError!;

    const { cleanUsername, cleanLink } = formatTelegram(body.telegramUsername, body.telegramLink);

    const modernPayload = {
      name: sanitizeString(body.name),
      brand_name: body.brandName ? sanitizeString(body.brandName) : null,
      logo_url: body.logoUrl ? body.logoUrl.trim() : null,
      partner_type: body.partnerType,
      status: body.status,
      description: body.description ? sanitizeString(body.description) : null,
      collaboration_scope: body.collaborationScope ? sanitizeString(body.collaborationScope) : null,
      benefits_summary: body.benefitsSummary ? sanitizeString(body.benefitsSummary) : null,
      founder_name: body.founderName ? sanitizeString(body.founderName) : null,
      founder_contact: body.founderContact ? sanitizeString(body.founderContact) : null,
      contact_name: body.contactName ? sanitizeString(body.contactName) : null,
      contact_role: body.contactRole ? sanitizeString(body.contactRole) : null,
      email: body.email ? body.email.trim() : null,
      phone: body.phone ? sanitizeString(body.phone) : null,
      telegram_username: cleanUsername || null,
      telegram_link: cleanLink || null,
      secondary_contact_name: body.secondaryContactName ? sanitizeString(body.secondaryContactName) : null,
      secondary_contact_phone: body.secondaryContactPhone ? sanitizeString(body.secondaryContactPhone) : null,
      secondary_contact_telegram: body.secondaryContactTelegram ? sanitizeString(body.secondaryContactTelegram) : null,
      website_url: body.websiteUrl ? body.websiteUrl.trim() : null,
      address: body.address ? sanitizeString(body.address) : null,
      country: body.country ? sanitizeString(body.country) : 'Cambodia',
      mou_signed_date: body.mouSignedDate || null,
      mou_expiry_date: body.mouExpiryDate || null,
      contract_document_url: body.contractDocumentUrl ? body.contractDocumentUrl.trim() : null,
      notes: body.notes ? sanitizeString(body.notes) : null,
      tags: body.tags || [],
      created_by: context.userId
    };

    let inserted: any = null;
    let insertError: any = null;

    // 1. Attempt modern schema insert first
    const modernResult = await adminSupabase
      .from('partners')
      .insert(modernPayload)
      .select('*')
      .single();

    if (!modernResult.error) {
      inserted = modernResult.data;
    } else {
      insertError = modernResult.error;

      // 2. If table doesn't exist, provide sample fallback
      if (insertError.code === '42P01') {
        const fallback = {
          id: crypto.randomUUID(),
          ...modernPayload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        return NextResponse.json({ success: true, data: normalizePartnerRecord(fallback), error: null }, { status: 201 });
      }

      // 3. If schema cache mismatch, check constraint, or contact_person constraint fails, fallback to legacy schema
      const isSchemaMismatch = 
        insertError.message?.includes('schema cache') ||
        insertError.message?.includes('contact_person') ||
        insertError.message?.includes('check constraint') ||
        insertError.code === 'PGRST204' ||
        insertError.code === '23502' ||
        insertError.code === '23514';

      if (isSchemaMismatch) {
        const legacyPayload: Record<string, any> = {
          name: sanitizeString(body.name),
          brand_name: body.brandName ? sanitizeString(body.brandName) : null,
          logo_url: body.logoUrl ? body.logoUrl.trim() : null,
          partner_type: normalizePartnerTypeToLegacy(body.partnerType),
          status: normalizeStatusToLegacy(body.status),
          description: body.description ? sanitizeString(body.description) : null,
          founder_name: body.founderName ? sanitizeString(body.founderName) : null,
          founder_contact: body.founderContact ? sanitizeString(body.founderContact) : null,
          contact_person: (body.contactName ? sanitizeString(body.contactName) : '') || sanitizeString(body.name),
          contact_role: body.contactRole ? sanitizeString(body.contactRole) : null,
          email: body.email ? body.email.trim() : null,
          phone: body.phone ? sanitizeString(body.phone) : null,
          telegram_username: cleanUsername || null,
          telegram_url: cleanLink || null,
          website: body.websiteUrl ? body.websiteUrl.trim() : null,
          city: body.address ? sanitizeString(body.address) : null,
          country: body.country ? sanitizeString(body.country) : 'Cambodia',
          mou_signed_date: body.mouSignedDate || null,
          mou_expiry_date: body.mouExpiryDate || null,
          document_url: body.contractDocumentUrl ? body.contractDocumentUrl.trim() : null,
          internal_notes: body.notes ? sanitizeString(body.notes) : null,
          tags: body.tags || [],
          secondary_contacts: body.secondaryContactName
            ? [{
                name: sanitizeString(body.secondaryContactName),
                phone: body.secondaryContactPhone ? sanitizeString(body.secondaryContactPhone) : null,
                telegram: body.secondaryContactTelegram ? sanitizeString(body.secondaryContactTelegram) : null
              }]
            : []
        };

        const legacyResult = await adminSupabase
          .from('partners')
          .insert(legacyPayload)
          .select('*')
          .single();

        if (!legacyResult.error) {
          inserted = legacyResult.data;
          insertError = null;
        } else {
          insertError = legacyResult.error;
        }
      }
    }

    if (insertError || !inserted) {
      return NextResponse.json(
        { success: false, data: null, error: { code: insertError?.code || 'INSERT_ERROR', message: insertError?.message || 'Failed to insert partner.' } },
        { status: 500 }
      );
    }

    await logSecurityAuditEvent({
      action: 'PARTNER_CREATED',
      performedBy: context.userId,
      targetId: inserted.id,
      details: { name: inserted.name, partnerType: inserted.partner_type },
      status: 'SUCCESS'
    });

    return NextResponse.json({ success: true, data: normalizePartnerRecord(inserted), error: null }, { status: 201 });
  } catch (err: any) {
    return formatServerErrorResponse(err);
  }
}

/**
 * PUT: Update an existing partner
 */
export async function PUT(req: Request) {
  try {
    const { errorResponse, context, adminSupabase } = await verifyCaller(req, [
      'Root', 'Super Root', 'Admin', 'Head Coach'
    ]);
    if (errorResponse || !adminSupabase || !context) return errorResponse!;

    const { data: body, errorResponse: parseError } = await validateRequestBody(UpdatePartnerSchema, req);
    if (parseError || !body) return parseError!;

    const { cleanUsername, cleanLink } = formatTelegram(body.telegramUsername, body.telegramLink);

    const updatePayload: Record<string, any> = {};
    if (body.name !== undefined) updatePayload.name = sanitizeString(body.name);
    if (body.brandName !== undefined) updatePayload.brand_name = body.brandName ? sanitizeString(body.brandName) : null;
    if (body.logoUrl !== undefined) updatePayload.logo_url = body.logoUrl ? body.logoUrl.trim() : null;
    if (body.partnerType !== undefined) updatePayload.partner_type = body.partnerType;
    if (body.status !== undefined) updatePayload.status = body.status;
    if (body.description !== undefined) updatePayload.description = body.description ? sanitizeString(body.description) : null;
    if (body.collaborationScope !== undefined) updatePayload.collaboration_scope = body.collaborationScope ? sanitizeString(body.collaborationScope) : null;
    if (body.benefitsSummary !== undefined) updatePayload.benefits_summary = body.benefitsSummary ? sanitizeString(body.benefitsSummary) : null;
    if (body.founderName !== undefined) updatePayload.founder_name = body.founderName ? sanitizeString(body.founderName) : null;
    if (body.founderContact !== undefined) updatePayload.founder_contact = body.founderContact ? sanitizeString(body.founderContact) : null;
    if (body.contactName !== undefined) updatePayload.contact_name = body.contactName ? sanitizeString(body.contactName) : null;
    if (body.contactRole !== undefined) updatePayload.contact_role = body.contactRole ? sanitizeString(body.contactRole) : null;
    if (body.email !== undefined) updatePayload.email = body.email ? body.email.trim() : null;
    if (body.phone !== undefined) updatePayload.phone = body.phone ? sanitizeString(body.phone) : null;
    if (body.telegramUsername !== undefined) updatePayload.telegram_username = cleanUsername || null;
    if (body.telegramLink !== undefined || body.telegramUsername !== undefined) updatePayload.telegram_link = cleanLink || null;
    if (body.secondaryContactName !== undefined) updatePayload.secondary_contact_name = body.secondaryContactName ? sanitizeString(body.secondaryContactName) : null;
    if (body.secondaryContactPhone !== undefined) updatePayload.secondary_contact_phone = body.secondaryContactPhone ? sanitizeString(body.secondaryContactPhone) : null;
    if (body.secondaryContactTelegram !== undefined) updatePayload.secondary_contact_telegram = body.secondaryContactTelegram ? sanitizeString(body.secondaryContactTelegram) : null;
    if (body.websiteUrl !== undefined) updatePayload.website_url = body.websiteUrl ? body.websiteUrl.trim() : null;
    if (body.address !== undefined) updatePayload.address = body.address ? sanitizeString(body.address) : null;
    if (body.country !== undefined) updatePayload.country = body.country ? sanitizeString(body.country) : 'Cambodia';
    if (body.mouSignedDate !== undefined) updatePayload.mou_signed_date = body.mouSignedDate || null;
    if (body.mouExpiryDate !== undefined) updatePayload.mou_expiry_date = body.mouExpiryDate || null;
    if (body.contractDocumentUrl !== undefined) updatePayload.contract_document_url = body.contractDocumentUrl ? body.contractDocumentUrl.trim() : null;
    if (body.notes !== undefined) updatePayload.notes = body.notes ? sanitizeString(body.notes) : null;
    if (body.tags !== undefined) updatePayload.tags = body.tags;

    if (!IS_UUID_REGEX.test(body.id)) {
      return NextResponse.json({ success: true, data: normalizePartnerRecord({ ...body, id: body.id, sample: true }), error: null });
    }

    let updated: any = null;
    let updateError: any = null;

    // 1. Try modern update first
    const modernResult = await adminSupabase
      .from('partners')
      .update(updatePayload)
      .eq('id', body.id)
      .select('*')
      .single();

    if (!modernResult.error) {
      updated = modernResult.data;
    } else {
      updateError = modernResult.error;

      if (updateError.code === '42P01' || updateError.code === '22P02') {
        return NextResponse.json({ success: true, data: normalizePartnerRecord({ ...body, id: body.id, sample: true }), error: null });
      }

      // 2. If schema mismatch or check constraint, map to legacy columns
      const isSchemaMismatch = 
        updateError.message?.includes('schema cache') ||
        updateError.message?.includes('check constraint') ||
        updateError.code === 'PGRST204' ||
        updateError.code === '23514';

      if (isSchemaMismatch) {
        const legacyUpdate: Record<string, any> = {};
        if (body.name !== undefined) legacyUpdate.name = sanitizeString(body.name);
        if (body.brandName !== undefined) legacyUpdate.brand_name = body.brandName ? sanitizeString(body.brandName) : null;
        if (body.logoUrl !== undefined) legacyUpdate.logo_url = body.logoUrl ? body.logoUrl.trim() : null;
        if (body.partnerType !== undefined) legacyUpdate.partner_type = normalizePartnerTypeToLegacy(body.partnerType);
        if (body.status !== undefined) legacyUpdate.status = normalizeStatusToLegacy(body.status);
        if (body.description !== undefined) legacyUpdate.description = body.description ? sanitizeString(body.description) : null;
        if (body.founderName !== undefined) legacyUpdate.founder_name = body.founderName ? sanitizeString(body.founderName) : null;
        if (body.founderContact !== undefined) legacyUpdate.founder_contact = body.founderContact ? sanitizeString(body.founderContact) : null;
        if (body.contactName !== undefined) legacyUpdate.contact_person = sanitizeString(body.contactName) || sanitizeString(body.name || 'Admin');
        if (body.contactRole !== undefined) legacyUpdate.contact_role = body.contactRole ? sanitizeString(body.contactRole) : null;
        if (body.email !== undefined) legacyUpdate.email = body.email ? body.email.trim() : null;
        if (body.phone !== undefined) legacyUpdate.phone = body.phone ? sanitizeString(body.phone) : null;
        if (body.telegramUsername !== undefined) legacyUpdate.telegram_username = cleanUsername || null;
        if (body.telegramLink !== undefined || body.telegramUsername !== undefined) legacyUpdate.telegram_url = cleanLink || null;
        if (body.websiteUrl !== undefined) legacyUpdate.website = body.websiteUrl ? body.websiteUrl.trim() : null;
        if (body.address !== undefined) legacyUpdate.city = body.address ? sanitizeString(body.address) : null;
        if (body.country !== undefined) legacyUpdate.country = body.country ? sanitizeString(body.country) : 'Cambodia';
        if (body.mouSignedDate !== undefined) legacyUpdate.mou_signed_date = body.mouSignedDate || null;
        if (body.mouExpiryDate !== undefined) legacyUpdate.mou_expiry_date = body.mouExpiryDate || null;
        if (body.contractDocumentUrl !== undefined) legacyUpdate.document_url = body.contractDocumentUrl ? body.contractDocumentUrl.trim() : null;
        if (body.notes !== undefined) legacyUpdate.internal_notes = body.notes ? sanitizeString(body.notes) : null;
        if (body.tags !== undefined) legacyUpdate.tags = body.tags;
        if (body.secondaryContactName !== undefined || body.secondaryContactPhone !== undefined || body.secondaryContactTelegram !== undefined) {
          legacyUpdate.secondary_contacts = body.secondaryContactName ? [{
            name: sanitizeString(body.secondaryContactName),
            phone: body.secondaryContactPhone ? sanitizeString(body.secondaryContactPhone) : null,
            telegram: body.secondaryContactTelegram ? sanitizeString(body.secondaryContactTelegram) : null
          }] : [];
        }

        const legacyResult = await adminSupabase
          .from('partners')
          .update(legacyUpdate)
          .eq('id', body.id)
          .select('*')
          .single();

        if (!legacyResult.error) {
          updated = legacyResult.data;
          updateError = null;
        } else {
          updateError = legacyResult.error;
        }
      }
    }

    if (updateError || !updated) {
      return NextResponse.json(
        { success: false, data: null, error: { code: updateError?.code || 'UPDATE_ERROR', message: updateError?.message || 'Failed to update partner.' } },
        { status: 500 }
      );
    }

    await logSecurityAuditEvent({
      action: 'PARTNER_UPDATED',
      performedBy: context.userId,
      targetId: body.id,
      details: { updatedFields: Object.keys(updatePayload) },
      status: 'SUCCESS'
    });

    return NextResponse.json({ success: true, data: normalizePartnerRecord(updated), error: null });
  } catch (err: any) {
    return formatServerErrorResponse(err);
  }
}

/**
 * DELETE: Remove a partner
 */
export async function DELETE(req: Request) {
  try {
    const { errorResponse, context, adminSupabase } = await verifyCaller(req, [
      'Root', 'Super Root', 'Admin', 'Head Coach'
    ]);
    if (errorResponse || !adminSupabase || !context) return errorResponse!;

    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'MISSING_PARAM', message: 'Partner ID is required.' } },
        { status: 400 }
      );
    }

    if (!IS_UUID_REGEX.test(id)) {
      return NextResponse.json({ success: true, data: { id, sample: true }, error: null });
    }

    const { error } = await adminSupabase
      .from('partners')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === '42P01' || error.code === '22P02') {
        return NextResponse.json({ success: true, data: { id, sample: true }, error: null });
      }
      return NextResponse.json(
        { success: false, data: null, error: { code: error.code || 'DELETE_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    await logSecurityAuditEvent({
      action: 'PARTNER_DELETED',
      performedBy: context.userId,
      targetId: id,
      status: 'SUCCESS'
    });

    return NextResponse.json({ success: true, data: { id }, error: null });
  } catch (err: any) {
    return formatServerErrorResponse(err);
  }
}
