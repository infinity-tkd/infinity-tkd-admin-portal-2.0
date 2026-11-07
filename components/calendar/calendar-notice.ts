import type { EventDraft } from './types';

// Matches the public snapshot created by portal_calendar_queue.
export function studentNoticePreview(event: Pick<EventDraft, 'title' | 'changeReason'>) {
  return {
    title: event.title,
    body: event.changeReason || 'An academy update is available. Open the event for details.',
  };
}
