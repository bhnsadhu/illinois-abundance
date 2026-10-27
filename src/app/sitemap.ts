import type { MetadataRoute } from 'next';
import { getAllStories, getLearnPages, getStoryTopics, getTopics, getWriters } from '@/lib/data';
import { site } from '@/lib/config';
import { isPathHidden } from '@/hidden/features';
import {getSiteContent} from '@/lib/site-content';
import {contentVisibility} from '@/lib/site-content-schema';
export const revalidate=60;
export default async function sitemap():Promise<MetadataRoute.Sitemap> {
  const hiddenFeatures=contentVisibility(await getSiteContent());
  const [stories,pages,topics,storyTopics,writers]=await Promise.all([getAllStories(),hiddenFeatures.learn?[]:getLearnPages(),getTopics(),getStoryTopics(),getWriters()]);
  const url=(path:string)=>new URL(path,site.url).toString();
  const allTopics=[...new Map([...topics,...storyTopics].map(topic=>[topic.id,topic])).values()];
  return [
    ...['/','/latest','/news','/about','/write','/events','/learn','/show-up'].filter(path=>!isPathHidden(path,hiddenFeatures)).map(path=>({url:url(path)})),
    ...stories.map(story=>({url:url(`/post/${story.slug}`),lastModified:story.updated_at})),
    ...pages.map(page=>({url:url(`/learn/${page.slug}`),lastModified:page.updated_at})),
    ...allTopics.map(topic=>({url:url(`/topic/${topic.slug}`)})),
    ...writers.map(writer=>({url:url(`/writer/${writer.slug}`)})),
  ];
}
