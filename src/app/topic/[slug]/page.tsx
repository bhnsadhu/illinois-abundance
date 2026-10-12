import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StoryCard } from '@/components/story-card';
import { ArrowRight } from '@/components/icons';
import { getTopicStories, getStoryTopics, getTopics } from '@/lib/data';

export const revalidate = 60;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const topic = (await getStoryTopics()).find(item => item.slug === slug);
  return topic ? { title: topic.name, description: topic.description, alternates: { canonical: `/topic/${topic.slug}` } } : { title: 'Topic not found' };
}

export default async function TopicPage({ params }: Props) {
  const [{ slug }, topics, storyTopics] = await Promise.all([params, getTopics(), getStoryTopics()]);
  const topic = [...topics,...storyTopics].find(item => item.slug === slug);
  if (!topic) notFound();
  const stories = await getTopicStories(topic.id);
  const illustration = ['housing', 'infrastructure', 'energy', 'healthcare', 'education', 'technology'].includes(topic.slug) ? topic.slug : 'housing';
  return <div className="container editorial-index">
    <header className="topic-heading">
      <div><Link className="eyebrow" href="/latest">A little more possibility</Link><h1>{topic.name}</h1><p>{topic.description}</p><span className="topic-story-count">{stories.length} {stories.length === 1 ? 'story' : 'stories'} and plenty of room for more.</span></div>
      <Image src={`/illustrations/${illustration}.svg`} width={800} height={560} alt={`Hand drawn illustration about ${topic.name.toLowerCase()}`} priority sizes="(max-width: 767px) 85vw, 40vw"/>
    </header>
    <nav className="topic-filters" aria-label="Explore stories by topic"><Link href="/latest">All stories</Link>{topics.map(item => <Link key={item.id} href={`/topic/${item.slug}`} aria-current={item.id === topic.id ? 'page' : undefined}>{item.name}</Link>)}</nav>
    {stories.length ? <div className="story-grid">{stories.map(story => <StoryCard key={story.id} story={story}/>)}</div> : <div className="empty-state"><h2>Nothing here yet.</h2><p>Have a question or an idea about {topic.name.toLowerCase()}? This is a good place to start.</p><Link href="/write" className="button">Write the first story <ArrowRight size={16}/></Link></div>}
  </div>;
}
