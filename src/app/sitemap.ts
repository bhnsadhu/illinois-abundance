import type { MetadataRoute } from 'next';
import { getAllStories, getLearnPages, getStoryTopics, getTopics, getWriters } from '@/lib/data';
import { site } from '@/lib/config';
export const revalidate=60;
export default async function sitemap():Promise<MetadataRoute.Sitemap> {
  const [stories,pages,topics,storyTopics,writers]=await Promise.all([getAllStories(),getLearnPages(),getTopics(),getStoryTopics(),getWriters()]);
  const url=(path:string)=>new URL(path,site.url).toString();
  const allTopics=[...new Map([...topics,...storyTopics].map(topic=>[topic.id,topic])).values()];
  return [
    ...['/','/latest','/about','/write','/events','/learn','/show-up'].map(path=>({url:url(path)})),
    ...stories.map(story=>({url:url(`/post/${story.slug}`),lastModified:story.updated_at})),
    ...pages.map(page=>({url:url(`/learn/${page.slug}`),lastModified:page.updated_at})),
    ...allTopics.map(topic=>({url:url(`/topic/${topic.slug}`)})),
    ...writers.map(writer=>({url:url(`/writer/${writer.slug}`)})),
  ];
}
