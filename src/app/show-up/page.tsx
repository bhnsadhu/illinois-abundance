import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowUpRight, CalendarDays, MapPin } from '@/components/icons';
import { getSiteContent } from '@/lib/site-content';
import { getUpcomingMeetings } from '@/lib/data';
import { eventDate } from '@/lib/syndication';
import { safeUrl } from '@/lib/format';
export const revalidate=60;
export async function generateMetadata():Promise<Metadata>{const content=await getSiteContent();return {title:'Show up',description:content.showUp.intro,alternates:{canonical:'/show-up'}};}
export default async function ShowUpPage() {
  const content=await getSiteContent();
  const meetings=await getUpcomingMeetings();
  return <div className="container extras-page"><header className="show-up-heading"><div><h1>{content.showUp.title}</h1><p>{content.showUp.intro}</p></div>{content.showUp.imageUrl&&<Image src={content.showUp.imageUrl} unoptimized width={800} height={560} alt={content.showUp.imageAlt} priority sizes="(max-width: 767px) 80vw, 40vw"/>}</header><section className="show-up-guide" aria-label="Getting ready for a public meeting">{content.showUp.steps.map((step,index)=><article key={step.title}><span aria-hidden="true">0{index+1}</span><h2>{step.title}</h2><p>{step.body}</p></article>)}</section><section className="extras-section"><div className="section-heading"><h2>{content.showUp.meetings}</h2></div><p className="meeting-note">{content.showUp.meetingNote}</p>{meetings.length?<div className="meeting-list">{meetings.map(meeting=>{const agenda=meeting.agenda_url?safeUrl(meeting.agenda_url):null;return <article className="meeting-row" key={meeting.id}><div><h3>{meeting.body_name}</h3>{meeting.is_sample&&<span className="sample-label">Sample meeting</span>}</div><div className="event-facts"><p><CalendarDays size={17}/><time dateTime={meeting.starts_at}>{eventDate(meeting.starts_at)}</time></p><p><MapPin size={17}/><span>{meeting.location}</span></p>{meeting.is_sample&&<p className="sample-caption">{content.showUp.sample}</p>}</div>{agenda&&<a className="text-link" href={agenda} target="_blank" rel="noopener noreferrer">{content.showUp.agendaLabel} <ArrowUpRight size={15}/></a>}</article>;})}</div>:<div className="empty-state"><h3>{content.showUp.empty}</h3><p>{content.showUp.emptyBody}</p></div>}</section></div>;
}
