import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { publicDatabase } from './database/public';
import { hasDatabase, samplesEnabled } from './config';
import { eventEnd } from './syndication';
import { getGoogleCalendarEvents, mergeCalendarEvents } from './google-calendar';
import type { Topic, Writer, PublicPost, Story, Event, LearnPage, Meeting } from './types';
import { sampleTopics, sampleWriters, samplePosts, sampleEvents, sampleLearnPages, sampleMeetings } from './sample-data';

function publicCache<Args extends unknown[], Result>(name: string, fn: (...args: Args) => Promise<Result>) {
  return cache(unstable_cache(fn, [name, hasDatabase() ? 'connected' : 'preview', String(samplesEnabled())], { revalidate: 60, tags: ['public-content'] }));
}

const fields = {
  topics: 'id,slug,name,description,sort_order,is_active,is_sample,image_url,image_alt',
  writers: 'id,slug,name,bio,avatar_url,avatar_alt,is_sample',
  posts: 'id,slug,author_name,final_body,headline,short_version,sources,topic_id,byline,writer_id,cover_url,cover_alt,published_at,updated_at,is_sample',
  events: 'id,slug,title,description,starts_at,ends_at,location,rsvp_url,recap_post_id,is_published,is_sample,image_url,image_alt',
  learn_pages: 'id,slug,title,short_version,body,is_published,is_sample,created_at,updated_at',
  meetings: 'id,body_name,starts_at,location,agenda_url,is_published,is_sample',
} as const;
const BATCH_SIZE = 250;
async function publicRows<T>(table: keyof typeof fields, samples: T[]): Promise<T[]> {
  const db = publicDatabase();
  if (!db) return table === 'topics' || samplesEnabled() ? samples : [];
  const rows: T[] = [];
  for (let offset = 0; ; offset += BATCH_SIZE) {
    const { data, error } = await db.from(`public_${table}`).select(fields[table]).order('id').range(offset, offset + BATCH_SIZE - 1);
    if (error) throw new Error('Public content is temporarily unavailable.');
    rows.push(...data as unknown as T[]);
    if (!data || data.length < BATCH_SIZE) return rows;
  }
}
export const getTopics = publicCache('getTopics', async () => (await publicRows<Topic>('topics', sampleTopics)).filter(t=>t.is_active).sort((a,b)=>a.sort_order-b.sort_order));
// Aggregates cache their complete result. Use request-memoized loaders inside
// them so nested persistent cache writes cannot race a concurrent directory read.
const loadStoryTopics = cache(async ():Promise<Topic[]> => { const db=publicDatabase(); if(!db)return sampleTopics; const {data,error}=await db.from('public_story_topics').select(fields.topics); if(error)throw new Error('Public content is temporarily unavailable.');return data as Topic[]; });
const loadWriters = cache(async () => publicRows<Writer>('writers', sampleWriters));
export const getStoryTopics = publicCache('getStoryTopics', loadStoryTopics);
export const getWriters = publicCache('getWriters', loadWriters);
async function attachStories(posts: PublicPost[]): Promise<Story[]> {
 const [topics,writers]=await Promise.all([loadStoryTopics(),loadWriters()]);
 return posts.flatMap(post=>{const topic=topics.find(t=>t.id===post.topic_id);return topic?[{...post,topic,writer:writers.find(w=>w.id===post.writer_id)||null}]:[];});
}
async function storyRows(limit?: number, offset = 0, filter?: { column: 'topic_id' | 'writer_id'; value: string }): Promise<PublicPost[]> {
  if (!Number.isSafeInteger(offset) || offset < 0 || (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1))) return [];
  const db = publicDatabase();
  if (!db) return samplesEnabled() ? [...samplePosts].filter(post => !filter || post[filter.column] === filter.value).sort((a,b) => Date.parse(b.published_at)-Date.parse(a.published_at) || b.id.localeCompare(a.id)).slice(offset, limit === undefined ? undefined : offset+limit) : [];
  const rows: PublicPost[] = [];
  while (limit === undefined || rows.length < limit) {
    const size = Math.min(BATCH_SIZE, limit === undefined ? BATCH_SIZE : limit-rows.length);
    let query = db.from('public_posts').select(fields.posts).order('published_at',{ascending:false}).order('id',{ascending:false}).range(offset+rows.length,offset+rows.length+size-1);
    if (filter) query = query.eq(filter.column, filter.value);
    const { data, error } = await query;
    if (error) throw new Error('Public content is temporarily unavailable.');
    rows.push(...data as PublicPost[]);
    if (!data || data.length < size) break;
  }
  return rows;
}
export const getStories = publicCache('getStories', async (limit:number = 100, offset:number = 0):Promise<Story[]> => attachStories(await storyRows(limit, offset)));
export const getAllStories = publicCache('getAllStories', async ():Promise<Story[]> => attachStories(await storyRows()));
export const getTopicStories = publicCache('getTopicStories', async (topicId: string, limit?: number, offset:number = 0):Promise<Story[]> => attachStories(await storyRows(limit, offset, {column:'topic_id',value:topicId})));
export const getWriterStories = publicCache('getWriterStories', async (writerId: string):Promise<Story[]> => attachStories(await storyRows(undefined, 0, {column:'writer_id',value:writerId})));
export const getRecapStories = publicCache('getRecapStories', async (ids: string[]):Promise<Story[]> => {
  if (!ids.length) return [];
  const db = publicDatabase();
  if (!db) return attachStories(samplesEnabled() ? samplePosts.filter(post => ids.includes(post.id)) : []);
  const rows: PublicPost[] = [];
  for (let offset=0; offset<ids.length; offset+=BATCH_SIZE) {
    const { data,error }=await db.from('public_posts').select(fields.posts).in('id',ids.slice(offset,offset+BATCH_SIZE));
    if (error) throw new Error('Public content is temporarily unavailable.');
    rows.push(...data as PublicPost[]);
  }
  return attachStories(rows);
});
export const searchStories = publicCache('searchStories', async (query: string, limit:number=13, offset:number=0):Promise<Story[]> => {
  const text=query.trim();
  if (!text || text.length>200 || !Number.isSafeInteger(offset) || offset<0 || offset>100000) return [];
  const db=publicDatabase();
  if (!db) return attachStories(samplesEnabled() ? samplePosts.filter(post=>`${post.headline} ${post.short_version} ${post.final_body}`.toLowerCase().includes(text.toLowerCase())).slice(offset,offset+limit) : []);
  const { data,error }=await db.rpc<PublicPost[]>('search_public_posts',{p_query:text,p_limit:limit,p_offset:offset});
  if (error) throw new Error('Search is temporarily unavailable.');
  return attachStories(data || []);
});
export const getStory = publicCache('getStory', async (slug:string):Promise<Story|undefined>=>{
 const db=publicDatabase();if(!db){const post=samplesEnabled()?samplePosts.find(p=>p.slug===slug):undefined;return post?(await attachStories([post]))[0]:undefined;}
 const {data,error}=await db.from('public_posts').select(fields.posts).eq('slug',slug).maybeSingle();if(error)throw new Error('Stories are temporarily unavailable.');return !data?undefined:(await attachStories([data as PublicPost]))[0];
});
const loadEvents = cache(async () => (await publicRows<Event>('events',sampleEvents)).filter(e=>e.is_published).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)));
export const getEvents = publicCache('getEvents', loadEvents);
export const getLearnPages = publicCache('getLearnPages', async () => (await publicRows<LearnPage>('learn_pages',sampleLearnPages)).filter(p=>p.is_published));
const loadMeetings = cache(async () => (await publicRows<Meeting>('meetings',sampleMeetings)).filter(m=>m.is_published).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)));
export const getMeetings = publicCache('getMeetings', loadMeetings);
export const getUpcomingMeetings = publicCache('getUpcomingMeetings', async () => { const now=Date.now(); return (await loadMeetings()).filter(meeting=>Date.parse(meeting.starts_at)>=now); });
export const getEventGroups = publicCache('getEventGroups', async () => {
  const now=Date.now();
  const [local, calendar]=await Promise.all([loadEvents(),getGoogleCalendarEvents()]);
  const events=mergeCalendarEvents(local,calendar);
  return {events, upcoming:events.filter(event=>eventEnd(event)>now), past:events.filter(event=>eventEnd(event)<=now).reverse()};
});
export function illustrationFor(slug: string) { return `/illustrations/${['housing','infrastructure','energy','healthcare','education','technology'].includes(slug) ? slug : 'housing'}.svg`; }
export function coverFor(story: Story) { return story.cover_url || story.topic.image_url || illustrationFor(story.topic.slug); }
export function coverAlt(story: Story) { return story.cover_alt || story.topic.image_alt || `Hand drawn illustration about ${story.topic.name.toLowerCase()}`; }

export async function getNextEvent() { return (await getEventGroups()).upcoming[0]; }
