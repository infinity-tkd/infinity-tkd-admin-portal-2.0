export const eventTypes = ['holiday', 'competition', 'workshop', 'maintenance', 'academy', 'class_change'] as const;
export type EventType = typeof eventTypes[number];
export type EventLifecycle = 'scheduled' | 'postponed' | 'cancelled' | 'completed';
export interface EventAudience {
  mode: 'all' | 'branches' | 'classes' | 'students' | 'staff';
  branchIds: number[];
  classIds: number[];
  studentIds: string[];
}
export interface EventAttachment { id?: string; label: string; url: string; mimeType?: string; bytes?: number; studentAvailable?: boolean }
export interface EventDraft {
  title: string;
  type: EventType;
  lifecycle: EventLifecycle;
  startDate: string;
  endDate: string;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string;
  location: string;
  description: string;
  internalNotes: string;
  audience: EventAudience;
  attachments: EventAttachment[];
  changeReason: string;
}
export interface EventRecord extends EventDraft {
  id: string;
  revision: number;
  publishedRevision: number | null;
  hasUnpublishedChanges: boolean;
  publishedAt?: string | null;
  lastNotifiedRevision?: number | null;
  previousStartDate?: string | null;
  editable?: boolean;
  archivedAt?: string | null;
  archiveReason?: string | null;
}
export interface CalendarData {
  events: EventRecord[];
  nextCursor?: string | null;
  lookups: {
    branches: { id: number; name: string }[];
    classes: { id: number; name: string }[];
    students: { id: string; name: string }[];
  };
  permissions: { create: boolean; edit: boolean; publish: boolean; notify: boolean; archive?: boolean };
}
export const typeNames: Record<EventType, string> = {
  holiday: 'Holiday', competition: 'Competition', workshop: 'Workshop', maintenance: 'Maintenance', academy: 'Academy event', class_change: 'Class change',
};
