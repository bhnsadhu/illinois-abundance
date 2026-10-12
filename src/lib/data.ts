import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { publicDatabase } from './database/public';
import { samplesEnabled } from './config';
import type { Topic, Writer, PublicPost, Story, Event, LearnPage, Meeting } from './types';
import { sampleTopics, sampleWriters, samplePosts, sampleEvents, sampleLearnPages, sampleMeetings } from './sample-data';

function publicCache<Args extends unknown[], Result>(fn: (...args: Args) => Promise<Result>) {
  return cache(unstable_cache(fn, [], { revalidate: 60, tags: ['public-content'] }));
}

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
export const getTopics = publicCache(async () => (await publicRows<Topic>('topics', sampleTopics)).filter(t=>t.is_active).sort((a,b)=>a.sort_order-b.sort_order));
export const getStoryTopics = publicCache(async ():Promise<Topic[]> => { const db=publicDatabase(); if(!db)return sampleTopics; const {data,error}=await db.from('public_story_topics').select(fields.topics); if(error)return getTopics();return data as Topic[]; });
export const getWriters = publicCache(async () => publicRows<Writer>('writers', sampleWriters));
async function attachStories(posts: PublicPost[]): Promise<Story[]> {
 const [topics,writers]=await Promise.all([getStoryTopics(),getWriters()]);
 return posts.flatMap(post=>{const topic=topics.find(t=>t.id===post.topic_id);return topic?[{...post,topic,writer:writers.find(w=>w.id===post.writer_id)||null}]:[];});
}
export const getStories = publicCache(async (limit:number=100,offset:number=0):Promise<Story[]> => {
 const db=publicDatabase();
 if(!db)return attachStories(samplesEnabled()?[...samplePosts].sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at)).slice(offset,offset+limit):[]);
 const {data,error}=await db.from('public_posts').select(fields.posts).order('published_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+Math.min(limit,1000)-1);
 if(error)return [];return attachStories(data as PublicPost[]);
});
export const getTopicStories = publicCache(async (topicId:string,limit:number=100,offset:number=0):Promise<Story[]>=>{
 const db=publicDatabase();if(!db)return attachStories(samplesEnabled()?samplePosts.filter(p=>p.topic_id===topicId).sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at)).slice(offset,offset+limit):[]);
 const {data,error}=await db.from('public_posts').select(fields.posts).eq('topic_id',topicId).order('published_at',{ascending:false}).range(offset,offset+Math.min(limit,1000)-1);return error?[]:attachStories(data as PublicPost[]);
});
export const getWriterStories = publicCache(async (writerId:string):Promise<Story[]>=>{
 const db=publicDatabase();if(!db)return attachStories(samplesEnabled()?samplePosts.filter(p=>p.writer_id===writerId):[]);
 const {data,error}=await db.from('public_posts').select(fields.posts).eq('writer_id',writerId).order('published_at',{ascending:false}).limit(100);return error?[]:attachStories(data as PublicPost[]);
});
export const getStory = publicCache(async (slug:string):Promise<Story|undefined>=>{
 const db=publicDatabase();if(!db){const post=samplesEnabled()?samplePosts.find(p=>p.slug===slug):undefined;return post?(await attachStories([post]))[0]:undefined;}
 const {data,error}=await db.from('public_posts').select(fields.posts).eq('slug',slug).maybeSingle();return error||!data?undefined:(await attachStories([data as PublicPost]))[0];
});
export const getEvents = publicCache(async () => (await publicRows<Event>('events',sampleEvents)).filter(e=>e.is_published).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)));
export const getLearnPages = publicCache(async () => (await publicRows<LearnPage>('learn_pages',sampleLearnPages)).filter(p=>p.is_published));
export const getMeetings = publicCache(async () => (await publicRows<Meeting>('meetings',sampleMeetings)).filter(m=>m.is_published).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)));
export function illustrationFor(slug: string) { return `/illustrations/${['housing','infrastructure','energy','healthcare','education','technology'].includes(slug) ? slug : 'housing'}.svg`; }
export function coverFor(story: Story) { return story.cover_url || illustrationFor(story.topic.slug); }
export function coverAlt(story: Story) { return story.cover_alt || `Hand drawn illustration about ${story.topic.name.toLowerCase()}`; }

export async function getNextEvent() { const now=Date.now(); return (await getEvents()).find(event=>Date.parse(event.starts_at)>now); }
