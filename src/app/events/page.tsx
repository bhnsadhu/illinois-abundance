import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Download, MapPin, CalendarDays, ArrowRight } from '@/components/icons';
import { getEventGroups, getRecapStories } from '@/lib/data';
import { content } from '@/lib/content';
import { safeUrl } from '@/lib/format';
import { eventDate } from '@/lib/syndication';
import type { Event, Story } from '@/lib/types';
export const revalidate=60;
export const metadata:Metadata={title:'Events',description:content.events.intro,alternates:{canonical:'/events'}};
function EventDetails({event,recap,past=false}:{event:Event;recap?:Story;past?:boolean}) {
  const rsvp=event.rsvp_url?safeUrl(event.rsvp_url):null;
  return <><p className="event-description">{event.description}</p><div className="event-facts"><p><CalendarDays size={17}/><time dateTime={event.starts_at}>{eventDate(event.starts_at)}</time></p><p><MapPin size={17}/><span>{event.location}</span></p></div>{event.is_sample&&<p className="sample-caption">{content.events.sample}</p>}<div className="event-actions">{rsvp&&!past&&<a href={rsvp} className="button button-small" target="_blank" rel="noopener noreferrer">RSVP <ArrowUpRight size={15}/></a>}{!past&&<a className="text-link" href={`/events/${event.id}/calendar.ics`}>Add to calendar <Download size={15}/></a>}{recap&&<Link className="text-link" href={`/post/${recap.slug}`}>Read the recap <ArrowRight size={15}/></Link>}</div></>;
}
export default async function EventsPage() {
  const {events,upcoming,past}=await getEventGroups();
  const recaps=await getRecapStories(events.flatMap(event=>event.recap_post_id?[event.recap_post_id]:[]));
  const next=upcoming[0];
  return <div className="container extras-page"><header className="page-heading"><p className="eyebrow">Come with a question</p><h1>{content.events.title}</h1><p>{content.events.intro}</p></header>{next?<section className="next-event" id={`event-${next.id}`} aria-labelledby="next-event-title"><div><p className="eyebrow">{content.events.next}{next.is_sample&&<span className="sample-label">Sample event</span>}</p><h2 id="next-event-title">{next.title}</h2><EventDetails event={next} recap={recaps.find(story=>story.id===next.recap_post_id)}/></div><Image src="/illustrations/education.svg" alt="Hand drawn books and a notebook" width={800} height={560} sizes="(max-width: 767px) 80vw, 35vw" priority/></section>:<div className="empty-state"><h2>{content.events.empty}</h2><p>{content.events.emptyBody}</p><Link className="text-link" href="/learn">Find something to read <ArrowRight size={16}/></Link></div>}{upcoming.length>1&&<section className="extras-section"><div className="section-heading"><h2>{content.events.upcoming}</h2></div><div className="event-list">{upcoming.slice(1).map(event=><article key={event.id} id={`event-${event.id}`} className="event-row"><div><p className="eyebrow">Upcoming{event.is_sample&&<span className="sample-label">Sample event</span>}</p><h3>{event.title}</h3></div><div><EventDetails event={event} recap={recaps.find(story=>story.id===event.recap_post_id)}/></div></article>)}</div></section>}{past.length>0&&<section className="extras-section"><div className="section-heading"><h2>{content.events.past}</h2></div><div className="event-list">{past.map(event=><article key={event.id} id={`event-${event.id}`} className="event-row"><div><p className="eyebrow">Past event{event.is_sample&&<span className="sample-label">Sample event</span>}</p><h3>{event.title}</h3></div><div><EventDetails event={event} recap={recaps.find(story=>story.id===event.recap_post_id)} past/></div></article>)}</div></section>}</div>;
}
