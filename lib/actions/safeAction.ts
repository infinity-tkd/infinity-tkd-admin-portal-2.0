/**
 * Safe Action Wrapper for Server Actions & API Handlers
 * Infinity Admin Portal
 */

import { z, ZodType } from 'zod';
import { supabase } from '@/lib/supabase';
import { translateSupabaseError } from '@/lib/errors/supabaseErrorTranslator';
import {
  ActionResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/types/actionResponse';

export interface ActionAuthContext {
  userId: string;
  email: string;
  role?: string;
}

export interface SafeActionOptions<TInput> {
  schema?: ZodType<TInput>;
  allowedRoles?: string[];
  requireAuth?: boolean;
}

/**
 * Wraps server actions or logic handlers with authentication verification,
 * strict Zod validation, and translated error isolation.
 */
export function createSafeAction<TInput, TOutput>(
  options: SafeActionOptions<TInput>,
  handler: (input: TInput, context?: ActionAuthContext) => Promise<TOutput>
): (rawInput: unknown) => Promise<ActionResponse<TOutput>> {
  return async (rawInput: unknown): Promise<ActionResponse<TOutput>> => {
    try {
      let authContext: ActionAuthContext | undefined;

      // 1. Authentication Check
      if (options.requireAuth !== false) {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          return createErrorResponse(
            'AUTH_UNAUTHORIZED',
            'Your session has expired or is invalid. Please sign in again.'
          );
        }

        authContext = {
          userId: user.id,
          email: user.email || '',
        };

        // If specific roles required, verify profile role
        if (options.allowedRoles && options.allowedRoles.length > 0) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, is_active')
            .eq('id', user.id)
            .single();

          if (!profile || !profile.is_active) {
            return createErrorResponse(
              'AUTH_FORBIDDEN',
              'Access denied. Account is inactive or unverified.'
            );
          }

          if (!options.allowedRoles.includes(profile.role)) {
            return createErrorResponse(
              'AUTH_FORBIDDEN',
              `Insufficient permissions. Required role: [${options.allowedRoles.join(', ')}]`
            );
          }

          authContext.role = profile.role;
        }
      }

      // 2. Input Validation via Zod
      let validatedInput = rawInput as TInput;
      if (options.schema) {
        const parseResult = options.schema.safeParse(rawInput);
        if (!parseResult.success) {
          return createErrorResponse(
            'VALIDATION_FAILED',
            'The submitted request payload contains invalid fields.',
            parseResult.error.flatten()
          );
        }
        validatedInput = parseResult.data;
      }

      // 3. Execution
      const result = await handler(validatedInput, authContext);
      return createSuccessResponse(result);
    } catch (err: any) {
      console.error('[SAFE_ACTION_ERROR]', err);
      const translated = translateSupabaseError(err);
      return createErrorResponse(
        translated.code,
        translated.userMessage,
        process.env.NODE_ENV === 'development' ? err?.message : undefined
      );
    }
  };
}
