import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from '@/components/icons';
import { getLearnPages } from '@/lib/data';
import { getSiteContent } from '@/lib/site-content';
export const revalidate=60;
export async function generateMetadata():Promise<Metadata>{const content=await getSiteContent();return {title:'Learn',description:content.learn.intro,alternates:{canonical:'/learn'}};}
export default async function LearnPage() {
  const content=await getSiteContent();
  const pages=await getLearnPages();
  return <div className="container extras-page"><header className="learn-heading"><div><h1>{content.learn.title}</h1><p>{content.learn.intro}</p></div>{content.learn.imageUrl&&<Image src={content.learn.imageUrl} unoptimized width={800} height={560} alt={content.learn.imageAlt} loading="eager" sizes="(max-width: 767px) 80vw, 35vw"/>}</header>{pages.length?<div className="learn-grid">{pages.map((page,index)=><article key={page.id}><Link href={`/learn/${page.slug}`} className="learn-card"><div className="learn-card-top"><span className="eyebrow">Guide · {String(index+1).padStart(2,'0')}</span><ArrowUpRight size={20}/></div>{page.is_sample&&<span className="sample-label">Sample explainer</span>}<h2>{page.title}</h2><p>{page.short_version}</p><span className="text-link">{content.learn.readLabel} <ArrowRight size={16}/></span></Link></article>)}</div>:<div className="empty-state"><h2>{content.learn.empty}</h2><p>{content.learn.emptyBody}</p></div>}</div>;
}
