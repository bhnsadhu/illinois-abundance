import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StoryCard } from '@/components/story-card';
import { ArrowRight } from '@/components/icons';
import { getWriters, getWriterStories } from '@/lib/data';
import {getSiteContent} from '@/lib/site-content';
import Image from 'next/image';
import { initials } from '@/lib/format';
export const revalidate=60;
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata> {
  const {slug}=await params, writer=(await getWriters()).find(item=>item.slug===slug);
  const {reader}=await getSiteContent();
  return writer ? {title:writer.name,description:writer.bio || reader.writerIntro,alternates:{canonical:`/writer/${writer.slug}`}} : {title:'Writer not found'};
}
export default async function WriterPage({params}:Props) {
  const {slug}=await params, writer=(await getWriters()).find(item=>item.slug===slug);
  if(!writer)notFound();
  const stories=await getWriterStories(writer.id);const {reader}=await getSiteContent();
  return <div className="container extras-page"><header className="writer-heading"><span className="writer-monogram" aria-hidden="true">{writer.avatar_url?<Image src={writer.avatar_url} alt={writer.avatar_alt||writer.name} width={144} height={144} unoptimized/>:initials(writer.name)}</span><div><h1>{writer.name}</h1>{writer.is_sample&&<span className="sample-label">Sample writer profile</span>}{writer.bio&&<p className="writer-bio">{writer.bio}</p>}</div></header><section aria-label={`Stories by ${writer.name}`}>{stories.length?<div className="story-grid">{stories.map(story=><StoryCard key={story.id} story={story}/>)}</div>:<div className="empty-state"><h2>{reader.writerEmpty}</h2><Link href="/latest" className="text-link">{reader.readLatest} <ArrowRight size={16}/></Link></div>}</section></div>;
}
