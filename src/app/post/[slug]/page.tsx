import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Author } from '@/components/author';
import { BodyText } from '@/components/body-text';
import { StoryCard } from '@/components/story-card';
import { ViewCounter } from '@/components/view-counter';
import { ShareActions } from '@/components/share-actions';
import { ArrowLeft, ArrowRight, ArrowUpRight } from '@/components/icons';
import { coverAlt, coverFor, getStory, getStories } from '@/lib/data';
import { formatDate, initials, readTime, safeUrl } from '@/lib/format';
import { site } from '@/lib/config';

export const revalidate = 60;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const story = await getStory((await params).slug);
  if (!story) return { title: 'Story not found' };
  return {
    title: story.headline, description: story.short_version, alternates: { canonical: `/post/${story.slug}` },
    openGraph: { title: story.headline, description: story.short_version, type: 'article', publishedTime: story.published_at, modifiedTime: story.updated_at, authors: [story.byline], url: `/post/${story.slug}`, images: [{ url: `/post/${story.slug}/opengraph-image`, width: 1200, height: 630, alt: story.headline }] },
    twitter: { card: 'summary_large_image', title: story.headline, description: story.short_version, images: [`/post/${story.slug}/opengraph-image`] },
  };
}

export default async function PostPage({ params }: Props) {
  const story = await getStory((await params).slug);
  if (!story) notFound();
  const related = (await getStories()).filter(item => item.id !== story.id).sort((a, b) => Number(b.topic_id === story.topic_id) - Number(a.topic_id === story.topic_id)).slice(0, 3);
  const sources = story.sources.flatMap(source => { const url = safeUrl(source.url); return url ? [{ ...source, url }] : []; });
  const author = story.byline || story.author_name;
  const removalSubject = encodeURIComponent(`Removal request: ${story.headline}`);
  return <>
    <ViewCounter postId={story.id}/>
    <article className="editorial-article">
      <header className="article-heading container">
        <Link href="/latest" className="text-link article-back"><ArrowLeft size={15}/> All stories</Link>
        <div className="article-kicker"><Link className="topic-label" href={`/topic/${story.topic.slug}`}>{story.topic.name}</Link><span aria-hidden="true">·</span><time dateTime={story.published_at}>{formatDate(story.published_at, { year: 'numeric' })}</time>{story.is_sample && <span className="sample-label">Sample story</span>}</div>
        <h1>{story.headline}</h1>
        <p className="article-deck">{story.short_version}</p>
        <Author name={author} href={story.writer ? `/writer/${story.writer.slug}` : undefined} readTime={readTime(story.final_body)}/>
      </header>
      <div className={`article-cover container topic-color-${story.topic.slug}`}><Image src={coverFor(story)} alt={coverAlt(story)} width={800} height={560} priority sizes="(max-width: 767px) 100vw, 1100px" unoptimized={Boolean(story.cover_url)}/></div>
      <div className="article-reading">
        <BodyText body={story.final_body}/>
        {sources.length > 0 && <section className="article-sources" aria-labelledby="sources-heading"><h2 id="sources-heading">Sources</h2><ul>{sources.map((source, i) => <li key={`${source.url}-${i}`}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}<ArrowUpRight size={15} aria-label="Opens in a new tab"/></a></li>)}</ul></section>}
        {new Date(story.updated_at).getTime() > new Date(story.published_at).getTime() + 1000 && <p className="article-updated">Updated <time dateTime={story.updated_at}>{formatDate(story.updated_at, { year: 'numeric' })}</time></p>}
        <aside className="writer-box" aria-label="About the writer"><span className="writer-avatar" aria-hidden="true">{initials(author)}</span><div><p className="eyebrow">Written by</p><h2>{story.writer ? <Link href={`/writer/${story.writer.slug}`}>{author}</Link> : author}</h2>{story.writer?.bio && <p>{story.writer.bio}</p>}{story.writer && <Link className="text-link" href={`/writer/${story.writer.slug}`}>More from {story.writer.name.split(' ')[0]} <ArrowRight size={15}/></Link>}</div></aside>
        <section className="article-share" aria-label="Share this story"><h2>Share this story</h2><ShareActions slug={story.slug}/></section>
        <a className="removal-link" href={`mailto:${site.contact}?subject=${removalSubject}`}>Request removal</a>
      </div>
    </article>
    {related.length > 0 && <section className="container related-stories" aria-labelledby="related-heading"><div className="section-heading"><h2 id="related-heading">More stories</h2><Link href="/latest" className="text-link">All stories <ArrowUpRight size={16}/></Link></div><div className="story-grid">{related.map(item => <StoryCard key={item.id} story={item}/>)}</div></section>}
  </>;
}
