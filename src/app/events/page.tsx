import { LocationLink } from '@/components/location-link';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Download, CalendarDays, ArrowRight } from '@/components/icons';
import { EventJoinLink } from '@/components/event-join-link';
import { EventRecurrence } from '@/components/event-recurrence';
import { getEventGroups, getRecapStories } from '@/lib/data';
import { getSiteContent } from '@/lib/site-content';
import type {SiteContent} from '@/lib/site-content-schema';
import { safeUrl } from '@/lib/format';
import { eventLocation } from '@/lib/event-links';
import { eventDate } from '@/lib/syndication';
import { googleCalendarHref } from '@/lib/google-calendar';
import type { Event, Story } from '@/lib/types';
export const revalidate=60;
export async function generateMetadata():Promise<Metadata>{const content=await getSiteContent();return {title:'Events',description:content.events.intro,alternates:{canonical:'/events'}};}
function EventDetails({event,recap,past=false,copy}:{event:Event;recap?:Story;past?:boolean;copy:SiteContent['events']}) {
  const location=eventLocation(event);
  const rsvp=event.rsvp_url?safeUrl(event.rsvp_url):null;
  return <>{event.description&&<p className="event-description">{event.description}</p>}<div className="event-facts"><p><CalendarDays size={17}/><time dateTime={event.starts_at}>{eventDate(event.starts_at,event.all_day)}</time></p><EventRecurrence event={event}/><LocationLink location={location}/></div>{event.is_sample&&<p className="sample-caption">{copy.sample}</p>}<div className="event-actions">{!past&&<EventJoinLink href={event.join_url} label={copy.joinLabel}/>}{rsvp&&!past&&<a href={rsvp} className="button button-small" target="_blank" rel="noopener noreferrer">{copy.rsvpLabel} <ArrowUpRight size={15}/></a>}{event.calendar_url?<a className="text-link" href={event.calendar_url} target="_blank" rel="noopener noreferrer">View in Google Calendar <ArrowUpRight size={15}/></a>:!past&&<a className="text-link" href={`/events/${event.id}/calendar.ics`}>{copy.calendarLabel} <Download size={15}/></a>}{recap&&<Link className="text-link" href={`/post/${recap.slug}`}>{copy.recapLabel} <ArrowRight size={15}/></Link>}</div></>;
}
export default async function EventsPage() {
  const content=await getSiteContent();
  const {events,upcoming,past}=await getEventGroups();
  const recaps=await getRecapStories(events.flatMap(event=>event.recap_post_id?[event.recap_post_id]:[]));
  const next=upcoming[0];
  return <div className="container extras-page"><header className="page-heading"><h1>{content.events.title}</h1><p>{content.events.intro}</p><a className="text-link" href={googleCalendarHref} target="_blank" rel="noopener noreferrer">Follow our Google Calendar <ArrowUpRight size={16}/></a></header>{next?<section className="next-event" id={`event-${next.id}`} aria-labelledby="next-event-title"><div><p className="eyebrow">{content.events.next}{next.is_sample&&<span className="sample-label">Sample event</span>}</p><h2 id="next-event-title">{next.title}</h2><EventDetails copy={content.events} event={next} recap={recaps.find(story=>story.id===next.recap_post_id)}/></div>{(next.image_url||content.events.imageUrl)&&<Image src={next.image_url||content.events.imageUrl} alt={next.image_alt||content.events.imageAlt} unoptimized width={800} height={560} sizes="(max-width: 767px) 80vw, 35vw" loading="eager"/>}</section>:<div className="empty-state"><h2>{content.events.empty}</h2><p>{content.events.emptyBody}</p></div>}{upcoming.length>1&&<section className="extras-section"><div className="section-heading"><h2>{content.events.upcoming}</h2></div><div className="event-list">{upcoming.slice(1,9).map(event=><article key={event.id} id={`event-${event.id}`} className="event-row"><div>{event.image_url&&<Image className="event-row-image" src={event.image_url} alt={event.image_alt||event.title} width={400} height={280} unoptimized/>}<h3>{event.title}</h3></div><div><EventDetails copy={content.events} event={event} recap={recaps.find(story=>story.id===event.recap_post_id)}/></div></article>)}</div>{upcoming.length>9&&<a className="text-link" href={googleCalendarHref} target="_blank" rel="noopener noreferrer">More dates on Google Calendar <ArrowUpRight size={16}/></a>}</section>}{past.length>0&&<section className="extras-section"><div className="section-heading"><h2>{content.events.past}</h2></div><div className="event-list">{past.map(event=><article key={event.id} id={`event-${event.id}`} className="event-row"><div>{event.image_url&&<Image className="event-row-image" src={event.image_url} alt={event.image_alt||event.title} width={400} height={280} unoptimized/>}<h3>{event.title}</h3></div><div><EventDetails copy={content.events} event={event} recap={recaps.find(story=>story.id===event.recap_post_id)} past/></div></article>)}</div></section>}</div>;
}
