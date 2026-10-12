import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BodyText } from '@/components/body-text';
import { ArrowLeft, ArrowRight } from '@/components/icons';
import { getLearnPages } from '@/lib/data';
import { formatDate, readTime } from '@/lib/format';
export const revalidate=60;
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata> {
  const {slug}=await params,page=(await getLearnPages()).find(item=>item.slug===slug);
  return page?{title:page.title,description:page.short_version,alternates:{canonical:`/learn/${page.slug}`},openGraph:{title:page.title,description:page.short_version,type:'article'}}:{title:'Guide not found'};
}
export default async function LearnDetail({params}:Props) {
  const {slug}=await params,page=(await getLearnPages()).find(item=>item.slug===slug);
  if(!page)notFound();
  return <><header className="container article-heading learn-article-heading"><Link href="/learn" className="text-link article-back"><ArrowLeft size={15}/>All guides</Link><div className="article-kicker"><span className="topic-label">Explainer</span><span>{readTime(page.body)} min read</span>{page.is_sample&&<span className="sample-label">Sample explainer</span>}</div><h1>{page.title}</h1><p className="article-deck">{page.short_version}</p></header><article className="article-reading"><BodyText body={page.body}/><p className="article-updated">Updated <time dateTime={page.updated_at}>{formatDate(page.updated_at,{year:'numeric'})}</time></p><div className="learn-finish"><h2>Have a question?</h2><p>Read more student writing or send us a piece about a local issue.</p><Link href="/latest" className="text-link">Read the latest <ArrowRight size={16}/></Link><Link href="/write" className="text-link">Write for us <ArrowRight size={16}/></Link></div></article></>;
}
