import { ArrowUpRight } from './icons';
import { googleMeetUrl } from '@/lib/event-links';

export function EventJoinLink({href, label}: {href?: string; label: string}) {
  const url = googleMeetUrl(href);
  return url ? <a href={url} className="button button-small" target="_blank" rel="noopener noreferrer">{label} <ArrowUpRight size={15}/></a> : null;
}
