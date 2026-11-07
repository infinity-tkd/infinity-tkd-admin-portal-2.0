'use client';
import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Portal } from '@/components/Portal';
import { useModalFocus } from '@/hooks/use-modal-focus';
import styles from './calendar.module.css';

export function CalendarDialog({ title, subtitle, children, footer, onClose, busy = false, sheet = false }: {
  title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; onClose: () => void; busy?: boolean; sheet?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref, () => { if (!busy) onClose(); });
  return <Portal><div className={`${styles.theme} ${styles.backdrop} ${sheet ? styles.sheetBackdrop : ''}`} onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div ref={ref} className={`${styles.dialog} ${sheet ? styles.sheet : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} aria-busy={busy}>
      <div className={styles.dialogHeader}><div>{subtitle}<h2>{title}</h2></div><button type="button" className={styles.iconButton} onClick={onClose} disabled={busy} aria-label="Close event dialog"><X size={18}/></button></div>
      {children}
      {footer && <div className={styles.dialogFooter}>{footer}</div>}
    </div>
  </div></Portal>;
}
