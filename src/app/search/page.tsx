import type { Metadata } from 'next';
import Link from 'next/link';
import { StoryCard } from '@/components/story-card';
import { Search, ArrowRight, ArrowLeft } from '@/components/icons';
import { getTopics, searchStories } from '@/lib/data';
import { content } from '@/lib/content';
export const metadata:Metadata={title:'Search',description:content.search.intro,robots:{index:false,follow:true},alternates:{canonical:'/search'}};
export const revalidate=60;
export default async function SearchPage({searchParams}:{searchParams:Promise<{q?:string|string[];page?:string|string[]}>}) {
  const params=await searchParams;
  const raw=typeof params.q==='string'?params.q.trim():'';
  const query=raw.slice(0,200), tooLong=raw.length>200;
  const page=Math.min(8334,Math.max(1,Number.parseInt(typeof params.page==='string'?params.page:'1',10)||1));
  const [topics,results]=await Promise.all([getTopics(),query&&!tooLong?searchStories(query,13,(page-1)*12):Promise.resolve([])]);
  const stories=results.slice(0,12), hasNext=results.length>12 && page<8334;
  const pageUrl=(number:number)=>`/search?${new URLSearchParams({q:query,page:String(number)})}`;
  return <div className="container extras-page"><header className="page-heading"><h1>{content.search.title}</h1><p>{content.search.intro}</p></header><form action="/search" method="get" role="search" className="story-search"><label htmlFor="story-search" className="sr-only">Search published stories</label><Search size={22} aria-hidden="true"/><input id="story-search" name="q" type="search" maxLength={200} defaultValue={query} placeholder="Search housing, buses, energy…" required/><button type="submit" className="button">Search <ArrowRight size={16}/></button></form><p className="search-hint">{content.search.hint}</p>{tooLong?<div className="alert alert-error" role="alert">Keep your search to 200 characters or fewer.</div>:query?<section className="search-results" aria-label="Search results"><div className="section-heading"><h2>Stories for “{query}”</h2>{(page>1||hasNext)&&<span className="muted">Page {page}</span>}</div>{stories.length?<div className="story-grid">{stories.map(story=><StoryCard key={story.id} story={story}/>)}</div>:<div className="empty-state"><h2>{content.search.empty}</h2><p>{content.search.emptyBody}</p></div>}{(page>1||hasNext)&&<nav className="results-pagination" aria-label="Search result pages">{page>1?<Link className="text-link" href={pageUrl(page-1)}><ArrowLeft size={16}/>Previous page</Link>:<span/>}{hasNext&&<Link className="text-link" href={pageUrl(page+1)}>Next page<ArrowRight size={16}/></Link>}</nav>}</section>:null}<nav className="topic-filters search-topics" aria-label="Explore topics">{topics.map(topic=><Link key={topic.id} href={`/topic/${topic.slug}`}>{topic.name}</Link>)}</nav></div>;
}
