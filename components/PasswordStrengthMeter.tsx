'use client';

import React from 'react';
import { evaluatePasswordStrength } from '@/lib/security';
import { Check, X } from '@phosphor-icons/react';

interface PasswordStrengthMeterProps {
  password?: string;
}

/**
 * Real-time Password Security & Entropy Meter
 * Displays strength progress, classification label, and rule checks.
 */
export function PasswordStrengthMeter({ password = '' }: PasswordStrengthMeterProps) {
  if (!password) return null;

  const evalResult = evaluatePasswordStrength(password);

  return (
    <div className="space-y-2 mt-2 select-none">
      {/* Strength Bar */}
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
        <span className="text-neutral-500 dark:text-neutral-400">Password Security:</span>
        <span style={{ color: evalResult.color }}>{evalResult.label}</span>
      </div>

      <div className="w-full h-1.5 bg-neutral-200 dark:bg-[#262626] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${evalResult.score}%`,
            backgroundColor: evalResult.color,
          }}
        />
      </div>

      {/* Rules Checklist */}
      <div className="grid grid-cols-2 gap-1 pt-1">
        {[
          { label: '8+ Characters', valid: evalResult.hasMinLength },
          { label: 'Uppercase (A-Z)', valid: evalResult.hasUppercase },
          { label: 'Lowercase (a-z)', valid: evalResult.hasLowercase },
          { label: 'Number (0-9)', valid: evalResult.hasNumber },
          { label: 'Special (!@#$)', valid: evalResult.hasSymbol },
        ].map((rule, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-[9px] font-medium">
            {rule.valid ? (
              <Check className="w-3 h-3 text-emerald-500 shrink-0" />
            ) : (
              <X className="w-3 h-3 text-neutral-400 shrink-0" />
            )}
            <span className={rule.valid ? 'text-neutral-700 dark:text-neutral-200 font-semibold' : 'text-neutral-400'}>
              {rule.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
