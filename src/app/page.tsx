import Image from 'next/image';
import { Reveal } from '@/components/reveal';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, CalendarDays, MapPin } from '@/components/icons';
import { SubscriptionForm } from '@/components/subscription-form';
import { StoryCard } from '@/components/story-card';
import { Author } from '@/components/author';
import { EventJoinLink } from '@/components/event-join-link';
import { HomeTitle } from '@/components/home-title';
import { getStories, getTopics, getNextEvent, coverFor, coverAlt } from '@/lib/data';
import { eventLocation } from '@/lib/event-links';
import { eventDate } from '@/lib/syndication';
import { googleCalendarHref } from '@/lib/google-calendar';
import { getSiteContent } from '@/lib/site-content';
import styles from './page.module.css';

export const revalidate = 60;

export default async function Home() {
  const [stories, topics, nextEvent, content] = await Promise.all([getStories(4), getTopics(), getNextEvent(), getSiteContent()]);
  const {home,visibility,reader,newsletter}=content;
  const featured = stories[0];
  const location = nextEvent ? eventLocation(nextEvent) : '';

  return <div className={`container ${styles.home}`}>
    <div className={styles.hero}>
      <header className={styles.heading}>
        <HomeTitle firstLine={home.firstLine} secondLine={home.secondLine}/>
        <p className={styles.intro}>{home.intro}</p>
        <div className={styles.introActions}>
          <Link className="button" href={home.primaryHref}>{home.primaryLabel}</Link>
          {visibility.homeWrite && <Link className="button button-outline" href={home.secondaryHref}>{home.secondaryLabel} <ArrowRight size={17}/></Link>}
        </div>
      </header>
      {visibility.homeEvent && <section className={styles.event} aria-labelledby="next-event-title">
        <h2 id="next-event-title">{home.eventLabel}</h2>
        {nextEvent ? <>
          <h3>{nextEvent.title}</h3>
          <div className={styles.eventDetails}>
            <p><CalendarDays size={18}/><time dateTime={nextEvent.starts_at}>{eventDate(nextEvent.starts_at, nextEvent.all_day)}</time></p>
            {location && <p><MapPin size={18}/><span>{location}</span></p>}
          </div>
          {nextEvent.is_sample && <p className={styles.sampleNote}>Sample event. Details are for demonstration.</p>}
        </> : <p>{home.eventEmptyBody}</p>}
        <div className={styles.eventActions}>
          <EventJoinLink href={nextEvent?.join_url} label={content.events.joinLabel}/>
          <Link href={nextEvent && home.eventLinkHref === '/events' ? `/events#event-${nextEvent.id}` : home.eventLinkHref} className="text-link">{home.eventLinkLabel} <ArrowRight size={17}/></Link>
          <a href={googleCalendarHref} className="text-link" target="_blank" rel="noopener noreferrer">Google Calendar <ArrowUpRight size={16}/></a>
        </div>
      </section>}
    </div>

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

    {visibility.homeRecent && stories.length > 1 && <Reveal className={styles.recent} aria-labelledby="recent-heading">
      <div className={styles.sectionHeading}>
        <h2 id="recent-heading">{home.recentTitle}</h2>
        <Link href="/latest">{home.allStoriesLabel} <ArrowRight size={16}/></Link>
      </div>
      <div className="story-grid">{stories.slice(1, 4).map(story => <StoryCard key={story.id} story={story}/>)}</div>
    </Reveal>}

    {home.newsItems.length > 0 && <Reveal className={styles.news} aria-labelledby="news-heading">
      <div className={styles.sectionHeading}><h2 id="news-heading">{home.newsTitle}</h2></div>
      <p className={styles.newsIntro}>{home.newsIntro}</p>
      <div className={styles.newsList}>{home.newsItems.map((item, index) => <article className={styles.newsItem} key={`${item.href}-${index}`}>
        <h3><a href={item.href} target="_blank" rel="noopener noreferrer">{item.title} <ArrowUpRight size={17}/></a></h3>
        <p>{item.description}</p>
        <div className={styles.newsSource}><span>{item.publisher}</span><span>{item.dateLabel}</span></div>
      </article>)}</div>
    </Reveal>}

    {visibility.homeTopics && <Reveal className={styles.topics} aria-labelledby="topics-heading">
      <div className={styles.sectionHeading}><h2 id="topics-heading">{home.topicsTitle}</h2></div>
      <div className={styles.topicList}>
        {topics.map(topic => <Link key={topic.id} href={`/topic/${topic.slug}`} className={styles.topic}>
          <div><h3>{topic.name}</h3><p>{topic.description}</p></div>
          <ArrowRight size={18}/>
        </Link>)}
      </div>
    </Reveal>}

    {visibility.newsletter && visibility.homeNewsletter && <Reveal className={styles.subscribe} id="subscribe" aria-labelledby="subscribe-heading">
      <div><h2 id="subscribe-heading">{newsletter.homeTitle}</h2><p>{newsletter.homeIntro}</p></div>
      <SubscriptionForm copy={content.newsletter} compact/>
    </Reveal>}
  </div>;
}
