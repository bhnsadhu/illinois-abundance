import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StoryCard } from '@/components/story-card';
import { ArrowRight } from '@/components/icons';
import { getWriters, getWriterStories } from '@/lib/data';
import { content } from '@/lib/content';
import { initials } from '@/lib/format';
export const revalidate=60;
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata> {
  const {slug}=await params, writer=(await getWriters()).find(item=>item.slug===slug);
  return writer ? {title:writer.name,description:writer.bio || content.writer.intro,alternates:{canonical:`/writer/${writer.slug}`}} : {title:'Writer not found'};
}
export default async function WriterPage({params}:Props) {
  const {slug}=await params, writer=(await getWriters()).find(item=>item.slug===slug);
  if(!writer)notFound();
  const stories=await getWriterStories(writer.id);
  return <div className="container extras-page"><header className="writer-heading"><span className="writer-monogram" aria-hidden="true">{initials(writer.name)}</span><div><p className="eyebrow">{content.writer.eyebrow}</p><h1>{writer.name}</h1>{writer.is_sample&&<span className="sample-label">Sample writer profile</span>}<p className="writer-bio">{writer.bio || content.writer.intro}</p><span className="muted">{stories.length} {stories.length===1?'published story':'published stories'}</span></div></header><section aria-label={`Stories by ${writer.name}`}>{stories.length?<div className="story-grid">{stories.map(story=><StoryCard key={story.id} story={story}/>)}</div>:<div className="empty-state"><h2>{content.writer.empty}</h2><Link href="/latest" className="text-link">Read the latest <ArrowRight size={16}/></Link></div>}</section></div>;
}
