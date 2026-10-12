import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import { SubscriptionForm } from '@/components/subscription-form';
import { StoryCard } from '@/components/story-card';
import { Author } from '@/components/author';
import { getStories, getTopics, getNextEvent, coverFor, coverAlt } from '@/lib/data';
import { formatDate } from '@/lib/format';
import styles from './page.module.css';

export const revalidate = 60;

export default async function Home() {
  const [stories, topics, nextEvent] = await Promise.all([getStories(4), getTopics(), getNextEvent()]);
  const featured = stories[0];

  return <div className={`container ${styles.home}`}>
    <header className={styles.heading}>
      <h1>Latest</h1>
      <p>Student writing on local policy<br className={styles.desktopBreak}/> in Champaign Urbana.</p>
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
      <div className={styles.sectionHeading}><h2 id="topics-heading">Topics</h2><p>What we write about</p></div>
      <div className={styles.topicList}>
        {topics.map((topic, index) => <Link key={topic.id} href={`/topic/${topic.slug}`} className={styles.topic}>
          <span className={styles.topicNumber}>{String(index + 1).padStart(2, '0')}</span>
          <div><h3>{topic.name}</h3><p>{topic.description}</p></div>
          <ArrowRight size={18}/>
        </Link>)}
      </div>
    </section>

    <section className={styles.participate} aria-label="Get involved">
      <div className={styles.write}>
        <span className={styles.label}>Write for us</span>
        <h2>What would you change<br/> about this place?</h2>
        <p>Rent, the bus ride to class, a city council decision. If there’s something you want to write about, send it in. A student reviewer will help you edit it.</p>
        <Link className="text-link" href="/write">Send us a piece <ArrowRight size={17}/></Link>
      </div>
      <div className={styles.event}>
        <span className={styles.label}>Next teach in</span>
        <h2>{nextEvent ? nextEvent.title : 'We’re planning the next one.'}</h2>
        {nextEvent ? <>
          <div className={styles.eventDetails}>
            <time dateTime={nextEvent.starts_at}>{formatDate(nextEvent.starts_at, { month: 'long', day: 'numeric' })} at {formatDate(nextEvent.starts_at, { month: undefined, day: undefined, hour: 'numeric', minute: '2-digit' })}</time>
            <span>{nextEvent.location}</span>
          </div>
          {nextEvent.is_sample && <p className={styles.sampleNote}>Sample event. Details are for demonstration.</p>}
        </> : <p>Upcoming dates and locations will be posted here. You don’t need any policy background to come along.</p>}
        <Link href="/events" className="text-link">View events <ArrowRight size={17}/></Link>
      </div>
    </section>

    <section className={styles.subscribe} id="subscribe" aria-labelledby="subscribe-heading">
      <div><h2 id="subscribe-heading">Get the email</h2><p>New writing and upcoming teach ins.<br/>Unsubscribe whenever you like.</p></div>
      <SubscriptionForm compact/>
    </section>
  </div>;
}
