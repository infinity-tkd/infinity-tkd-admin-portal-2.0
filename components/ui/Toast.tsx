'use client';

/**
 * Smart Toast Notification System with Retry Action Triggers
 * Infinity Admin Portal
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X, RotateCcw } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number; // 0 = persistent
  action?: ToastAction;
}

interface ToastContextType {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  dismissToast: (id: string) => void;
  success: (message: string, options?: Partial<ToastItem>) => string;
  error: (message: string, options?: Partial<ToastItem>) => string;
  warning: (message: string, options?: Partial<ToastItem>) => string;
  info: (message: string, options?: Partial<ToastItem>) => string;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>): string => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    // Errors default to persistent (0 duration) or 8s if not specified, while others default to 4s
    const defaultDuration = toast.type === 'error' ? 0 : 4000;
    const item: ToastItem = {
      ...toast,
      id,
      duration: toast.duration !== undefined ? toast.duration : defaultDuration,
    };

    setToasts((prev) => [...prev, item]);
    return id;
  }, []);

  const success = useCallback(
    (message: string, options?: Partial<ToastItem>) =>
      addToast({ type: 'success', message, ...options }),
    [addToast]
  );

  const error = useCallback(
    (message: string, options?: Partial<ToastItem>) =>
      addToast({ type: 'error', message, ...options }),
    [addToast]
  );

  const warning = useCallback(
    (message: string, options?: Partial<ToastItem>) =>
      addToast({ type: 'warning', message, ...options }),
    [addToast]
  );

  const info = useCallback(
    (message: string, options?: Partial<ToastItem>) =>
      addToast({ type: 'info', message, ...options }),
    [addToast]
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        dismissToast,
        success,
        error,
        warning,
        info,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <section
      aria-label="Notifications"
      className="fixed bottom-4 right-4 left-4 md:left-auto md:w-[420px] z-[120] flex flex-col gap-2.5 pointer-events-none"
    >
      {toasts.map((toast) => (
        <SingleToast key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </section>
  );
}

function SingleToast({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const [isExecutingAction, setIsExecutingAction] = useState(false);

  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return;

    const timer = setTimeout(() => {
      onDismiss();
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast.duration, onDismiss]);

  const config = {
    success: {
      icon: CheckCircle,
      borderColor: 'border-emerald-500/40',
      bgColor: 'bg-emerald-950/90',
      iconColor: 'text-emerald-400',
    },
    error: {
      icon: AlertCircle,
      borderColor: 'border-red-500/50',
      bgColor: 'bg-red-950/95',
      iconColor: 'text-red-400',
    },
    warning: {
      icon: AlertTriangle,
      borderColor: 'border-amber-500/40',
      bgColor: 'bg-amber-950/90',
      iconColor: 'text-amber-400',
    },
    info: {
      icon: Info,
      borderColor: 'border-blue-500/40',
      bgColor: 'bg-blue-950/90',
      iconColor: 'text-blue-400',
    },
  }[toast.type];

  const IconComponent = config.icon;

  const handleAction = async () => {
    if (!toast.action?.onClick) return;
    try {
      setIsExecutingAction(true);
      await toast.action.onClick();
      onDismiss();
    } catch (e) {
      console.error('[TOAST_ACTION_ERROR]', e);
    } finally {
      setIsExecutingAction(false);
    }
  };

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      className={`pointer-events-auto rounded-[8px] border ${config.borderColor} ${config.bgColor} p-3.5 shadow-2xl backdrop-blur-md text-white transition-all transform animate-in slide-in-from-bottom-2 duration-200 flex flex-col gap-2`}
    >
      <div className="flex items-start gap-3">
        <IconComponent className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconColor}`} />
        <div className="flex-1 min-w-0">
          {toast.title && <h4 className="text-sm font-semibold tracking-wide">{toast.title}</h4>}
          <p className="text-xs text-neutral-200 leading-relaxed break-words">{toast.message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="text-neutral-400 hover:text-white p-1 rounded-[8px] hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {toast.action && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleAction}
            disabled={isExecutingAction}
            className="flex items-center gap-1.5 px-3 py-1 rounded-[8px] bg-white/10 hover:bg-white/20 active:bg-white/30 text-xs font-semibold tracking-wide border border-white/15 transition-all text-white disabled:opacity-50"
          >
            <RotateCcw className={`w-3 h-3 ${isExecutingAction ? 'animate-spin' : ''}`} />
            <span>{toast.action.label}</span>
          </button>
        </div>
      )}
    </div>
  );
}
