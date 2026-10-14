import Image from 'next/image';
import Link from 'next/link';
import { Author } from '@/components/author';
import { coverAlt, coverFor } from '@/lib/data';
import type { Story } from '@/lib/types';

export function StoryCard({ story }: { story: Story }) {
  return <article className="story-card">
    <Link href={`/post/${story.slug}`} className="story-card-link">
      <div className={`story-card-cover topic-color-${story.topic.slug}`}>
        <Image src={coverFor(story)} alt={coverAlt(story)} width={800} height={560} sizes="(max-width: 640px) 100vw, (max-width: 1023px) 50vw, 33vw" unoptimized={Boolean(story.cover_url)} />
      </div>
      <div className="story-card-copy">
        <div className="story-card-labels"><span className="topic-label">{story.topic.name}</span>{story.is_sample && <span className="sample-label">Sample story</span>}</div>
        <h3>{story.headline}</h3>
        <p className="story-card-deck">{story.short_version}</p>
        <Author avatar={story.writer?.avatar_url} name={story.byline || story.author_name} date={story.published_at}/>
      </div>
    </Link>
  </article>;
}
