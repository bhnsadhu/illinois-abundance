import type { Metadata } from 'next';
import Link from 'next/link';
import {getSiteContent} from '@/lib/site-content';
import { StoryCard } from '@/components/story-card';
import { ArrowRight, ArrowLeft } from '@/components/icons';
import { getStories, getTopics } from '@/lib/data';

export const revalidate = 60;
export async function generateMetadata():Promise<Metadata>{const {stories}=await getSiteContent();return {title:stories.title,description:stories.intro,alternates:{canonical:'/latest'}};}

export default async function LatestPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const {stories:copy}=await getSiteContent();
  const {page}=await searchParams;
  const parsed = page && /^[1-9]\d*$/.test(page) ? Number(page) : 1;
  const pageNumber = Number.isSafeInteger(parsed*12) ? parsed : 1;
  const offset = (pageNumber-1)*12;
  const [stories,topics]=await Promise.all([getStories(13,offset),getTopics()]);
  const visible = stories.slice(0,12);
  return <div className="container editorial-index">
    <header className="page-heading"><h1>{copy.title}</h1><p>{copy.intro}</p></header>
    <nav className="topic-filters" aria-label="Explore stories by topic"><Link href="/latest" aria-current="page">All stories</Link>{topics.map(topic => <Link key={topic.id} href={`/topic/${topic.slug}`}>{topic.name}</Link>)}</nav>
    {visible.length ? <>
      <div className="story-grid">{visible.map(story => <StoryCard key={story.id} story={story}/>)}</div>
      {(pageNumber>1||stories.length>12)&&<div className="load-more"><p>Showing stories {offset+1}–{offset+visible.length}</p><nav className="latest-pagination" aria-label="Story pages">{pageNumber>1&&<Link href={pageNumber===2?'/latest':`/latest?page=${pageNumber-1}`} className="text-link"><ArrowLeft size={16}/>Previous stories</Link>}{stories.length>12&&<Link href={`/latest?page=${pageNumber+1}`} className="button button-outline">Load more <ArrowRight size={16}/></Link>}</nav></div>}
    </> : <div className="empty-state"><h2>{pageNumber>1?copy.endTitle:copy.emptyTitle}</h2>{pageNumber===1&&<p>{copy.emptyBody}</p>}<Link href={pageNumber>1?'/latest':'/write'} className="button">{pageNumber>1?copy.backLabel:copy.emptyAction} <ArrowRight size={16}/></Link></div>}
  </div>;
}
