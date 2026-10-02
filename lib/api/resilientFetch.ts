/**
 * Resilient Network Fetch Client with Exponential Backoff and Timeout Isolation
 * Infinity Admin Portal
 */

import { ActionResponse, createErrorResponse, createSuccessResponse } from '@/lib/types/actionResponse';
import { translateSupabaseError } from '@/lib/errors/supabaseErrorTranslator';

export interface ResilientFetchOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
  backoffMultiplier?: number;
  retryCondition?: (status: number, error?: unknown) => boolean;
}

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_BACKOFF_MS = 1000;
const DEFAULT_BACKOFF_MULTIPLIER = 2;

/**
 * Standard retry check for transient network drops or server strain (502, 503, 504, 408)
 */
function isRetryable(status: number, error?: unknown): boolean {
  if (status === 502 || status === 503 || status === 504 || status === 408) {
    return true;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('failed to fetch') ||
      msg.includes('network request failed') ||
      msg.includes('abort') ||
      msg.includes('timeout')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Executes an HTTP fetch with automatic exponential backoff retry and timeout isolation.
 */
export async function resilientFetch(
  input: RequestInfo | URL,
  options: ResilientFetchOptions = {}
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    initialBackoffMs = DEFAULT_INITIAL_BACKOFF_MS,
    backoffMultiplier = DEFAULT_BACKOFF_MULTIPLIER,
    retryCondition = isRetryable,
    ...fetchOptions
  } = options;

  let attempt = 0;
  let delay = initialBackoffMs;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Merge external abort signal if provided
    const onAbort = () => controller.abort();
    if (fetchOptions.signal) {
      if (fetchOptions.signal.aborted) {
        controller.abort();
      } else {
        fetchOptions.signal.addEventListener('abort', onAbort);
      }
    }

    try {
      const response = await fetch(input, {
        ...fetchOptions,
        signal: controller.signal,
      });

      if (response.ok) {
        return response;
      }

      // Check if server error is retryable
      if (attempt < maxRetries && retryCondition(response.status)) {
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= backoffMultiplier;
        continue;
      }

      return response;
    } catch (err: any) {
      if (attempt < maxRetries && retryCondition(0, err)) {
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= backoffMultiplier;
        continue;
      }

      throw err;
    } finally {
      clearTimeout(timeoutId);
      if (fetchOptions.signal) {
        fetchOptions.signal.removeEventListener('abort', onAbort);
      }
    }
  }

  throw new Error(`resilientFetch: Exceeded maximum retry attempts (${maxRetries})`);
}

/**
 * Executes a resilient fetch and parses JSON directly into an ActionResponse<T> envelope.
 */
export async function resilientFetchJson<T>(
  input: RequestInfo | URL,
  options: ResilientFetchOptions = {}
): Promise<ActionResponse<T>> {
  try {
    const response = await resilientFetch(input, options);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (data && data.error && typeof data.error === 'object' && 'code' in data.error) {
        return data as ActionResponse<T>;
      }
      const rawErrorMsg =
        (data && (data.error || data.message)) ||
        `HTTP Request Failed with status ${response.status} (${response.statusText})`;

      const translated = translateSupabaseError({
        status: response.status,
        message: rawErrorMsg,
      });

      return createErrorResponse(translated.code, translated.userMessage, data);
    }

    if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
      return data as ActionResponse<T>;
    }

    return createSuccessResponse<T>(data as T);
  } catch (err: any) {
    const translated = translateSupabaseError(err);
    return createErrorResponse(
      translated.code,
      translated.userMessage,
      process.env.NODE_ENV === 'development' ? err?.message : undefined
    );
  }
}
