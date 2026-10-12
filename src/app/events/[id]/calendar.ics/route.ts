import { getEvents } from '@/lib/data';
import { site } from '@/lib/config';
import { eventCalendar } from '@/lib/syndication';
export const revalidate=60;
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return new Response('Event not found',{status:404});
  const event=(await getEvents()).find(item=>item.id===id);
  if(!event)return new Response('Event not found',{status:404});
  return new Response(eventCalendar(event,site.url),{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':`attachment; filename="illinois-abundance-${event.id}.ics"`,'Cache-Control':'public, max-age=60, s-maxage=60','X-Content-Type-Options':'nosniff'}});
}
