import { Repeat2 } from 'lucide-react';
import type { Event } from '@/lib/types';

export function EventRecurrence({ event }: { event: Pick<Event, 'recurrence'> }) {
  if (!event.recurrence) return null;
  return <p><Repeat2 size={17} aria-hidden="true"/><span>{event.recurrence}</span></p>;
}
