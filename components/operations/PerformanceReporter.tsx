'use client';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Metric } from 'web-vitals';
export function PerformanceReporter() {
  useEffect(() => {
    let active = true;
    const navigationPage = window.location.pathname;
    const report = async (metric: Metric) => {
      if (!active || !Number.isFinite(metric.value) || !navigator.onLine) return;
      try {
        const { data: { session } } = await supabase.auth.getSession(); if (!session || !active) return;
        const page = metric.navigationURL ? new URL(metric.navigationURL, location.origin).pathname : navigationPage;
        const device = innerWidth < 640 ? 'phone' : innerWidth < 1024 ? 'tablet' : 'desktop';
        await fetch('/api/performance', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ page, device, metric: metric.name, value: metric.value, metricId: metric.id }), keepalive: true, signal: AbortSignal.timeout(5000) });
      } catch { /* Performance collection must never interrupt academy operations. */ }
    };
    void import('web-vitals').then(({ onLCP, onINP, onCLS }) => {
      if (!active) return;
      const options = { reportSoftNavs: true };
      onLCP(metric => void report(metric), options); onINP(metric => void report(metric), options); onCLS(metric => void report(metric), options);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  return null;
}
