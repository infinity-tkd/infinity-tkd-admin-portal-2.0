/**
 * Infinity TKD Environment Validation Engine
 * Validates critical environment variables at startup using Zod.
 * Rejects invalid, missing, or improperly exposed configurations.
 */

import { z } from 'zod';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_URL is required')
    .url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL')
    .refine((url) => !url.includes('your-project'), {
      message: 'NEXT_PUBLIC_SUPABASE_URL is unconfigured placeholder',
    }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, 'NEXT_PUBLIC_SUPABASE_ANON_KEY must be a valid JWT token'),
});

const serverEnvSchema = clientEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20, 'SUPABASE_SERVICE_ROLE_KEY must be a valid JWT service role token')
    .refine((key) => !key.startsWith('NEXT_PUBLIC_'), {
      message: 'SUPABASE_SERVICE_ROLE_KEY must NEVER be prefixed with NEXT_PUBLIC_',
    }),
  GEMINI_API_KEY: z.string().optional(),
  APP_URL: z.string().url().optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

function validateEnv(): ServerEnv {
  const isServer = typeof window === 'undefined';

  if (isServer) {
    const parsed = serverEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      APP_URL: process.env.APP_URL,
    });

    if (!parsed.success) {
      console.error('❌ CRITICAL: Environment configuration validation failed:');
      console.error(parsed.error.flatten().fieldErrors);
      throw new Error(
        `Invalid server environment variables: ${JSON.stringify(
          parsed.error.flatten().fieldErrors
        )}`
      );
    }
    return parsed.data;
  } else {
    const parsed = clientEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });

    if (!parsed.success) {
      console.error('❌ CRITICAL: Client environment configuration validation failed:');
      console.error(parsed.error.flatten().fieldErrors);
      throw new Error(
        `Invalid client environment variables: ${JSON.stringify(
          parsed.error.flatten().fieldErrors
        )}`
      );
    }
    return parsed.data as any;
  }
}

export const env = validateEnv();
