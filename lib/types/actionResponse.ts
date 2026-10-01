/**
 * Standardized Action & API Response Envelopes
 * Infinity Admin Portal
 */

export interface ActionErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ActionSuccess<T> {
  success: true;
  data: T;
  error: null;
}

export interface ActionFailure {
  success: false;
  data: null;
  error: ActionErrorDetail;
}

export type ActionResponse<T> = ActionSuccess<T> | ActionFailure;

/**
 * Type guard for successful action responses
 */
export function isActionSuccess<T>(response: ActionResponse<T>): response is ActionSuccess<T> {
  return response.success === true;
}

/**
 * Type guard for failed action responses
 */
export function isActionFailure<T>(response: ActionResponse<T>): response is ActionFailure {
  return response.success === false;
}

/**
 * Constructor helper for successful ActionResponse
 */
export function createSuccessResponse<T>(data: T): ActionSuccess<T> {
  return {
    success: true,
    data,
    error: null,
  };
}

/**
 * Constructor helper for failed ActionResponse
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: unknown
): ActionFailure {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}
