import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import { SubscriptionForm } from '@/components/subscription-form';
import { StoryCard } from '@/components/story-card';
import { Author } from '@/components/author';
import { HomeTitle } from '@/components/home-title';
import { getStories, getTopics, getNextEvent, coverFor, coverAlt } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { getSiteContent } from '@/lib/site-content';
import styles from './page.module.css';

export const revalidate = 60;

export default async function Home() {
  const [stories, topics, nextEvent, content] = await Promise.all([getStories(4), getTopics(), getNextEvent(), getSiteContent()]);
  const {home,visibility,reader,newsletter}=content;
  const featured = stories[0];

  return <div className={`container ${styles.home}`}>
    <header className={styles.heading}>
      <HomeTitle firstLine={home.firstLine} secondLine={home.secondLine}/>
      <p className={styles.intro}>{home.intro}</p>
      <div className={styles.introActions}><Link className="button" href={home.primaryHref}>{home.primaryLabel}</Link><Link className="text-link" href={home.secondaryHref}>{home.secondaryLabel} <ArrowRight size={17}/></Link></div>
    </header>

    {visibility.homeFeatured && (featured ? <section className={styles.feature} aria-labelledby="featured-title">
      <div className={styles.featureCopy}>
        <div className={styles.kicker}>
          <Link href={`/topic/${featured.topic.slug}`}>{featured.topic.name}</Link>
          {featured.is_sample && <span>Sample story</span>}
        </div>
        <h2 id="featured-title"><Link href={`/post/${featured.slug}`}>{featured.headline}</Link></h2>
        <p>{featured.short_version}</p>
        <Author avatar={featured.writer?.avatar_url} name={featured.byline} date={featured.published_at} href={featured.writer ? `/writer/${featured.writer.slug}` : undefined}/>
        <Link className={styles.readLink} href={`/post/${featured.slug}`}>{reader.readStory} <ArrowRight size={18}/></Link>
      </div>
      <Link href={`/post/${featured.slug}`} className={`${styles.featureVisual} topic-color-${featured.topic.slug}`} tabIndex={-1} aria-hidden="true">
        <Image src={coverFor(featured)} alt={coverAlt(featured)} width={800} height={560} priority unoptimized/>
      </Link>
    </section> : <section className="empty-state">
      <h2>{home.emptyTitle}</h2>
      <p>{home.emptyBody}</p>
      <Link className="button" href="/write">{home.emptyLinkLabel} <ArrowRight size={18}/></Link>
    </section>)}

    {visibility.homeRecent && stories.length > 1 && <section className={styles.recent} aria-labelledby="recent-heading">
      <div className={styles.sectionHeading}>
        <h2 id="recent-heading">{home.recentTitle}</h2>
        <Link href="/latest">{home.allStoriesLabel} <ArrowRight size={16}/></Link>
      </div>
      <div className="story-grid">{stories.slice(1, 4).map(story => <StoryCard key={story.id} story={story}/>)}</div>
    </section>}

    {visibility.homeTopics && <section className={styles.topics} aria-labelledby="topics-heading">
      <div className={styles.sectionHeading}><h2 id="topics-heading">{home.topicsTitle}</h2></div>
      <div className={styles.topicList}>
        {topics.map(topic => <Link key={topic.id} href={`/topic/${topic.slug}`} className={styles.topic}>
          <div><h3>{topic.name}</h3><p>{topic.description}</p></div>
          <ArrowRight size={18}/>
        </Link>)}
      </div>
    </section>}

    {(visibility.homeWrite || visibility.homeEvent) && <section className={styles.participate} aria-label="Get involved">
      {visibility.homeWrite && <div className={styles.write}>
        <h2>{home.writeTitle}</h2>
        <p>{home.writeDescription}</p>
        <Link className="text-link" href={home.writeLinkHref}>{home.writeLinkLabel} <ArrowRight size={17}/></Link>
      </div>}
      {visibility.homeEvent && <div className={styles.event}>
        {nextEvent && <span className={styles.label}>{home.eventLabel}</span>}
        <h2>{nextEvent ? nextEvent.title : home.eventEmptyTitle}</h2>
        {nextEvent ? <>
          <div className={styles.eventDetails}>
            <time dateTime={nextEvent.starts_at}>{formatDate(nextEvent.starts_at, { month: 'long', day: 'numeric' })} at {formatDate(nextEvent.starts_at, { month: undefined, day: undefined, hour: 'numeric', minute: '2-digit' })}</time>
            <span>{nextEvent.location}</span>
          </div>
          {nextEvent.is_sample && <p className={styles.sampleNote}>Sample event. Details are for demonstration.</p>}
        </> : <p>{home.eventEmptyBody}</p>}
        <Link href={home.eventLinkHref} className="text-link">{home.eventLinkLabel} <ArrowRight size={17}/></Link>
      </div>}
    </section>}

    {visibility.newsletter && visibility.homeNewsletter && <section className={styles.subscribe} id="subscribe" aria-labelledby="subscribe-heading">
      <div><h2 id="subscribe-heading">{newsletter.homeTitle}</h2><p>{newsletter.homeIntro}</p></div>
      <SubscriptionForm copy={content.newsletter} compact/>
    </section>}
  </div>;
}
