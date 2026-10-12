import type { Role } from './store';
import { hasPermission } from './permissions';
export * from './permissions';

/**
 * Validates route access for authorization guards
 */
export function canAccessRoute(role: Role | undefined | null, pathname: string): boolean {
  if (!role) return false;

  // Root / Super Root / Admin can access all routes
  if (role === 'Root' || role === 'Super Root' || role === 'Admin') {
    return true;
  }

  if (pathname.startsWith('/financials')) {
    return hasPermission(role, 'view:financials');
  }

  if (pathname.startsWith('/pos')) {
    return hasPermission(role, 'view:pos');
  }

  if (pathname.startsWith('/members')) {
    return hasPermission(role, 'manage:users');
  }

  if (pathname.startsWith('/students')) {
    return hasPermission(role, 'manage:students') || hasPermission(role, 'view:own_dossier');
  }

  if (pathname.startsWith('/schedule') || pathname.startsWith('/attendance')) {
    return hasPermission(role, 'mark:attendance') || hasPermission(role, 'manage:schedule');
  }

  if (pathname.startsWith('/library') || pathname.startsWith('/lms')) {
    return true; // Read-only access for logged-in users
  }

  return true;
}

import DOMPurify from 'dompurify';

/**
 * Escapes unsafe HTML characters to prevent XSS reflection attacks
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitizes rich text or HTML previews using DOMPurify
 */
export function sanitizeHtmlContent(dirtyHtml: string | null | undefined): string {
  if (!dirtyHtml) return '';
  const raw = String(dirtyHtml);

  if (typeof window !== 'undefined') {
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span', 'h1', 'h2', 'h3', 'h4'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    });
  }

  // Robust SSR Fallback
  return raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/href\s*=\s*["']?javascript:[^"'>]*/gi, 'href="#"')
    .replace(/on\w+\s*=\s*["']?[^"'>]*/gi, '');
}

/**
 * 3D Asset & WebGL Boundary Defense
 * Sanitizes 3D model paths to block directory traversal attacks (../) and unapproved sources
 */
export function sanitizeModelPath(rawPath: string | null | undefined): string {
  const DEFAULT_MODEL = '/models/atlas.json';
  if (!rawPath || typeof rawPath !== 'string') return DEFAULT_MODEL;

  const cleaned = rawPath.trim();

  // Block directory traversal (../, ..\, %2e%2e, null bytes)
  if (cleaned.includes('..') || cleaned.includes('\\') || /%2e/i.test(cleaned) || cleaned.includes('\0')) {
    console.warn('[SECURITY] Directory traversal blocked in 3D model path:', cleaned);
    return DEFAULT_MODEL;
  }

  // Enforce valid 3D file extensions
  if (!/\.(json|bin|gz|glb|gltf)$/i.test(cleaned)) {
    console.warn('[SECURITY] Invalid 3D model file extension blocked:', cleaned);
    return DEFAULT_MODEL;
  }

  // Allow approved local paths
  if (cleaned.startsWith('/models/')) {
    return cleaned;
  }

  // Allow trusted Supabase storage CDN
  try {
    const parsed = new URL(cleaned);
    const allowedHostPatterns = [/\.supabase\.co$/, /\.supabase\.com$/];
    if (allowedHostPatterns.some((pattern) => pattern.test(parsed.hostname))) {
      return cleaned;
    }
  } catch {
    // Malformed URL
  }

  console.warn('[SECURITY] Unapproved 3D asset source blocked:', cleaned);
  return DEFAULT_MODEL;
}

// --- 3. Password Strength & Entropy Engine ---

export interface PasswordSecurityEvaluation {
  score: number; // 0 to 100
  label: 'Weak' | 'Fair' | 'Good' | 'Strong' | 'Military-Grade';
  color: string;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  feedback: string[];
}

export function evaluatePasswordStrength(password: string): PasswordSecurityEvaluation {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  let score = 0;
  const feedback: string[] = [];

  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 15;
  if (hasUppercase) score += 15;
  if (hasLowercase) score += 15;
  if (hasNumber) score += 15;
  if (hasSymbol) score += 20;

  if (!hasMinLength) feedback.push('Use at least 8 characters');
  if (!hasUppercase) feedback.push('Add an uppercase letter (A-Z)');
  if (!hasLowercase) feedback.push('Add a lowercase letter (a-z)');
  if (!hasNumber) feedback.push('Add a number (0-9)');
  if (!hasSymbol) feedback.push('Add a special character (!@#$)');

  let label: 'Weak' | 'Fair' | 'Good' | 'Strong' | 'Military-Grade' = 'Weak';
  let color = '#EF2F38';

  if (score >= 90) {
    label = 'Military-Grade';
    color = '#10B981';
  } else if (score >= 75) {
    label = 'Strong';
    color = '#059669';
  } else if (score >= 50) {
    label = 'Good';
    color = '#F59E0B';
  } else if (score >= 30) {
    label = 'Fair';
    color = '#F97316';
  }

  return {
    score: Math.min(100, score),
    label,
    color,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSymbol,
    feedback,
  };
}

// --- 4. Rate Limiting & Anti-Double-Submit Tracker ---

class ClientRateLimiter {
  private attempts: Map<string, number[]> = new Map();

  /**
   * Checks if an action key has exceeded the rate limit without mutating state
   */
  isRateLimited(key: string, maxAttempts = 5, windowMs = 60000): boolean {
    const now = Date.now();
    const timestamps = (this.attempts.get(key) || []).filter(t => now - t < windowMs);
    return timestamps.length >= maxAttempts;
  }

  /**
   * Records a failed attempt timestamp for a given key
   */
  recordAttempt(key: string, windowMs = 60000): void {
    const now = Date.now();
    const timestamps = (this.attempts.get(key) || []).filter(t => now - t < windowMs);
    timestamps.push(now);
    this.attempts.set(key, timestamps);
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

export const securityRateLimiter = new ClientRateLimiter();

// --- 5. Session Fingerprinting ---

/**
 * Computes a non-invasive browser fingerprint for session hijacking detection
 */
export function generateSessionFingerprint(): string {
  if (typeof window === 'undefined') return 'SSR_FINGERPRINT';
  
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
  ];

  const rawStr = components.join('|');
  let hash = 0;
  for (let i = 0; i < rawStr.length; i++) {
    const char = rawStr.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }

  return 'FP_' + Math.abs(hash).toString(16);
}

// --- 6. Privacy-Conscious Logging & Safe Errors ---

const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'jwt',
  'authorization',
  'credit_card',
  'ssn',
  'service_role',
];

/**
 * Sanitizes object graphs to prevent logging secrets or PII
 */
export function sanitizeObjectForLogging(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObjectForLogging);

  const clean: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some(k => lowerKey.includes(k))) {
      clean[key] = '[REDACTED_SENSITIVE_DATA]';
    } else if (typeof obj[key] === 'object') {
      clean[key] = sanitizeObjectForLogging(obj[key]);
    } else {
      clean[key] = obj[key];
    }
  }
  return clean;
}

export function safeLog(...args: any[]): void {
  if (process.env.NODE_ENV === 'production') return; // Silence logs in production
  const sanitizedArgs = args.map(sanitizeObjectForLogging);
  console.log('[SECURITY_LOG]', ...sanitizedArgs);
}

export function safeLogError(message: string, error?: any): void {
  const safeErr = error?.message ? error.message.replace(/PG::[^\s]+/g, 'Database Error') : 'An internal error occurred.';
  console.error(`[SECURITY_ERROR] ${message}:`, safeErr);
}

/**
 * Transforms raw database or server exceptions into safe user-facing fallbacks
 */
export function formatSafeError(error: any): string {
  if (!error) return 'An unexpected error occurred. Please try again.';
  const msg = typeof error === 'string' ? error : error.message || '';

  // Intercept SQL / database trace errors
  if (msg.includes('duplicate key') || msg.includes('violates unique constraint')) {
    return 'A record with this information already exists.';
  }
  if (msg.includes('permission denied') || msg.includes('row-level security')) {
    return 'You do not have authorization to perform this operation.';
  }
  if (msg.includes('JWT') || msg.includes('invalid claim')) {
    return 'Your authentication session expired. Please sign in again.';
  }

  return msg.length < 120 && !msg.includes('postgres') && !msg.includes('SELECT') 
    ? msg 
    : 'Something went wrong. Please refresh or contact support.';
}

// --- 7. Session Timeout Constants ---
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;       // 15 Minutes Idle
export const WARNING_DURATION_MS = 2 * 60 * 1000;    // 2 Minutes Warning
export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 Hours Absolute
