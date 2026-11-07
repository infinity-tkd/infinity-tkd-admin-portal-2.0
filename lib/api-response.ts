export function unwrapApiError(errData: any, fallback = 'Operation failed'): string {
  if (!errData) return fallback;
  if (typeof errData === 'string') return errData;
  const error = errData.error;
  if (error?.code === 'VALIDATION_FAILED' && Array.isArray(error.issues)) {
    const issues = error.issues.slice(0, 5).map((issue: { field?: string; message?: string }) => {
      const field = (issue.field || 'Request').replace(/^(studentData|data)\./, '')
        .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\./g, ' / ');
      return `${field.charAt(0).toUpperCase()}${field.slice(1)}: ${issue.message || 'Invalid value.'}`;
    });
    if (issues.length) return `Invalid input. ${issues.join('; ')}`;
  }
  if (typeof error === 'string') return error;
  if (typeof error?.message === 'string') return error.message;
  if (typeof errData.message === 'string') return errData.message;
  return fallback;
}

/** A proxy or failed server may return HTML or an empty body instead of JSON. */
export async function readApiResponse(response: Response): Promise<any> {
  let body: any;
  try {
    body = await response.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid response');
  } catch {
    throw new Error(response.status === 401 ? 'Your session has expired. Please sign in again.'
      : 'The service returned an unreadable response. Reload the records to check whether your changes were saved before trying again.');
  }
  if (response.ok && body.success === false) throw new Error(unwrapApiError(body, 'The operation was not confirmed. Reload the records before trying again.'));
  return body;
}
