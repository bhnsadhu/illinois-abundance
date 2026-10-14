import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import { SubscriptionForm } from '@/components/subscription-form';
import { StoryCard } from '@/components/story-card';
import { Author } from '@/components/author';
import { HomeTitle } from '@/components/home-title';
import { getStories, getTopics, getNextEvent, coverFor, coverAlt } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { hiddenFeatures } from '@/hidden/features';
import styles from './page.module.css';

export const revalidate = 60;

export default async function Home() {
  const [stories, topics, nextEvent] = await Promise.all([getStories(4), getTopics(), getNextEvent()]);
  const featured = stories[0];

  return <div className={`container ${styles.home}`}>
    <header className={styles.heading}>
      <HomeTitle/>
      <p>Student stories about housing, transit, and life here.<br className={styles.desktopBreak}/> Campus events hosted by Illinois Abundance.</p>
      <div className={styles.introActions}><Link className="button" href="/latest">Read the stories</Link><Link className="text-link" href="/events">Come to a campus event <ArrowRight size={17}/></Link></div>
    </header>

    {featured ? <section className={styles.feature} aria-labelledby="featured-title">
      <div className={styles.featureCopy}>
        <div className={styles.kicker}>
          <Link href={`/topic/${featured.topic.slug}`}>{featured.topic.name}</Link>
          {featured.is_sample && <span>Sample story</span>}
        </div>
        <h2 id="featured-title"><Link href={`/post/${featured.slug}`}>{featured.headline}</Link></h2>
        <p>{featured.short_version}</p>
        <Author name={featured.byline} date={featured.published_at} href={featured.writer ? `/writer/${featured.writer.slug}` : undefined}/>
        <Link className={styles.readLink} href={`/post/${featured.slug}`}>Read the story <ArrowRight size={18}/></Link>
      </div>
      <Link href={`/post/${featured.slug}`} className={`${styles.featureVisual} topic-color-${featured.topic.slug}`} tabIndex={-1} aria-hidden="true">
        <Image src={coverFor(featured)} alt={coverAlt(featured)} width={800} height={560} priority unoptimized/>
      </Link>
    </section> : <section className="empty-state">
      <h2>Nothing here yet.</h2>
      <p>Have something to say about Champaign Urbana? Send us a piece.</p>
      <Link className="button" href="/write">Write for us <ArrowRight size={18}/></Link>
    </section>}

    {stories.length > 1 && <section className={styles.recent} aria-labelledby="recent-heading">
      <div className={styles.sectionHeading}>
        <h2 id="recent-heading">Recent writing</h2>
        <Link href="/latest">All stories <ArrowRight size={16}/></Link>
      </div>
      <div className="story-grid">{stories.slice(1, 4).map(story => <StoryCard key={story.id} story={story}/>)}</div>
    </section>}

    <section className={styles.topics} aria-labelledby="topics-heading">
      <div className={styles.sectionHeading}><h2 id="topics-heading">Topics</h2></div>
      <div className={styles.topicList}>
        {topics.map(topic => <Link key={topic.id} href={`/topic/${topic.slug}`} className={styles.topic}>
          <div><h3>{topic.name}</h3><p>{topic.description}</p></div>
          <ArrowRight size={18}/>
        </Link>)}
      </div>
    </section>

    <section className={styles.participate} aria-label="Get involved">
      <div className={styles.write}>
        <h2>Write for us</h2>
        <p>Share a local story or idea. A student reviewer will help you get it ready to publish.</p>
        <Link className="text-link" href="/write">Send us a piece <ArrowRight size={17}/></Link>
      </div>
      <div className={styles.event}>
        {nextEvent && <span className={styles.label}>Next campus event</span>}
        <h2>{nextEvent ? nextEvent.title : 'Campus events'}</h2>
        {nextEvent ? <>
          <div className={styles.eventDetails}>
            <time dateTime={nextEvent.starts_at}>{formatDate(nextEvent.starts_at, { month: 'long', day: 'numeric' })} at {formatDate(nextEvent.starts_at, { month: undefined, day: undefined, hour: 'numeric', minute: '2-digit' })}</time>
            <span>{nextEvent.location}</span>
          </div>
          {nextEvent.is_sample && <p className={styles.sampleNote}>Sample event. Details are for demonstration.</p>}
        </> : <p>New dates will appear here when they’re confirmed.</p>}
        <Link href="/events" className="text-link">View events <ArrowRight size={17}/></Link>
      </div>
    </section>

    {!hiddenFeatures.newsletter && <section className={styles.subscribe} id="subscribe" aria-labelledby="subscribe-heading">
      <div><span className={styles.label}>Stay in the loop</span><h2 id="subscribe-heading">Good ideas.<br/>In your inbox.</h2><p>New writing and upcoming teach ins.<br/>Unsubscribe whenever you like.</p></div>
      <SubscriptionForm compact/>
    </section>}
  </div>;
}
