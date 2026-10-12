import 'server-only';
import { cache } from 'react';
import { publicDatabase } from './supabase/public';
import { samplesEnabled } from './config';
import type { Topic, Writer, PublicPost, Story, Event, LearnPage, Meeting } from './types';
import { sampleTopics, sampleWriters, samplePosts, sampleEvents, sampleLearnPages, sampleMeetings } from './sample-data';

const fields = {
  topics: 'id,slug,name,description,sort_order,is_active,is_sample',
  writers: 'id,slug,name,bio,avatar_url,avatar_alt,is_sample',
  posts: 'id,slug,author_name,final_body,headline,short_version,sources,topic_id,byline,writer_id,cover_url,cover_alt,published_at,updated_at,is_sample',
  events: 'id,slug,title,description,starts_at,ends_at,location,rsvp_url,recap_post_id,is_published,is_sample',
  learn_pages: 'id,slug,title,short_version,body,is_published,is_sample,created_at,updated_at',
  meetings: 'id,body_name,starts_at,location,agenda_url,is_published,is_sample',
} as const;
async function publicRows<T>(table: keyof typeof fields, samples: T[]): Promise<T[]> {
  const db = publicDatabase();
  if (!db) return table === 'topics' || samplesEnabled() ? samples : [];
  const { data, error } = await db.from(`public_${table}`).select(fields[table] as string);
  if (error) { console.error(`Public content unavailable: ${table} (${error.code})`); return []; }
  return data as unknown as T[];
}
export const getTopics = cache(async () => (await publicRows<Topic>('topics', sampleTopics)).filter(t=>t.is_active).sort((a,b)=>a.sort_order-b.sort_order));
export const getWriters = cache(async () => publicRows<Writer>('writers', sampleWriters));
export const getStories = cache(async (): Promise<Story[]> => {
  const [posts, topics, writers] = await Promise.all([publicRows<PublicPost>('posts', samplePosts), getTopics(), getWriters()]);
  return posts.flatMap(post => { const topic = topics.find(t=>t.id===post.topic_id); return topic ? [{...post, topic, writer: writers.find(w=>w.id===post.writer_id)||null}] : []; }).sort((a,b)=>new Date(b.published_at).getTime()-new Date(a.published_at).getTime());
});
export const getStory = cache(async (slug: string) => (await getStories()).find(p=>p.slug===slug));
export const getEvents = cache(async () => (await publicRows<Event>('events',sampleEvents)).filter(e=>e.is_published).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)));
export const getLearnPages = cache(async () => (await publicRows<LearnPage>('learn_pages',sampleLearnPages)).filter(p=>p.is_published));
export const getMeetings = cache(async () => (await publicRows<Meeting>('meetings',sampleMeetings)).filter(m=>m.is_published).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)));
export function coverFor(story: Story) { return story.cover_url || `/illustrations/${story.topic.slug}.svg`; }
export function coverAlt(story: Story) { return story.cover_alt || `Hand drawn illustration about ${story.topic.name.toLowerCase()}`; }
