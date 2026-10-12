// Keep server-managed identity/timestamps out of the strict settings API.
const writableKeys=['academyName','legalName','tagline','logoUrl','websiteUrl','portalUrl','taxId','contactPhone','supportEmail','primaryAddress','defaultBranchId','currency','currencySymbol','earlyGroupTuitionUsd','standardTuitionUsd','tuitionGracePeriodDays','taxRatePercentage','dateFormat','defaultClassDurationMins','examPassingScore','minAttendanceExamPct','allowStudentPortalLogin','enableAudioChimes','facebookUrl','telegramChannel','instagramUrl'];
export function academyProfileChanges(updates:object){
 const values=updates as Record<string,unknown>;
 return Object.fromEntries(writableKeys.filter(key=>values[key]!==undefined).map(key=>[key,values[key]]));
}
