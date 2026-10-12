import type { Metadata } from 'next';
import Link from 'next/link';
import { StoryCard } from '@/components/story-card';
import { ArrowRight } from '@/components/icons';
import { getStories, getTopics } from '@/lib/data';

export const revalidate = 60;
export const metadata: Metadata = { title: 'Latest', description: 'The newest student ideas for a more abundant Champaign Urbana.', alternates: { canonical: '/latest' } };

export default async function LatestPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const {page}=await searchParams;
  const pageNumber = page && /^[1-9]\d{0,2}$/.test(page) ? Math.min(Number(page),80) : 1;
  const [stories,topics]=await Promise.all([getStories(pageNumber*12+1),getTopics()]);
  const visible = stories.slice(0, pageNumber * 12);
  return <div className="container editorial-index">
    <header className="page-heading"><p className="eyebrow"><span className="status-dot"/> Ideas from right here</p><h1>All the latest.</h1><p>Student writing on local policy in Champaign Urbana.</p></header>
    <nav className="topic-filters" aria-label="Explore stories by topic"><Link href="/latest" aria-current="page">All stories</Link>{topics.map(topic => <Link key={topic.id} href={`/topic/${topic.slug}`}>{topic.name}</Link>)}</nav>
    {visible.length ? <>
      <div className="story-grid">{visible.map(story => <StoryCard key={story.id} story={story}/>)}</div>
      <div className="load-more"><p>Showing {visible.length} {visible.length === 1 ? 'story' : 'stories'}</p>{visible.length < stories.length && <Link href={`/latest?page=${pageNumber + 1}`} scroll={false} className="button button-outline">Load more <ArrowRight size={16}/></Link>}</div>
    </> : <div className="empty-state"><h2>Nothing here yet.</h2><p>Every good conversation starts with a first idea. Yours could be it.</p><Link href="/write" className="button">Write for us <ArrowRight size={16}/></Link></div>}
  </div>;
}
