import { LocationLink } from '@/components/location-link';
import { PublicationLabel } from '@/components/publication-label';
import Image from 'next/image';
import { Reveal } from '@/components/reveal';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays } from '@/components/icons';
import { SubscriptionForm } from '@/components/subscription-form';
import { StoryCard } from '@/components/story-card';
import { Author } from '@/components/author';
import { EventJoinLink } from '@/components/event-join-link';
import { EventRecurrence } from '@/components/event-recurrence';
import { HomeTitle } from '@/components/home-title';
import { Garden } from '@/components/garden';
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
      <div className={styles.seedField} aria-hidden="true"/>
      <header className={styles.heading}>
        <HomeTitle firstLine={home.firstLine} secondLine={home.secondLine}/>
        <p className={styles.intro}>{home.intro}</p>
        <div className={styles.introActions}>
          <Link className="button" href={home.primaryHref}>{home.primaryLabel}</Link>
          {visibility.homeWrite && <Link className="button button-outline" href={home.secondaryHref}>{home.secondaryLabel} <ArrowRight size={17}/></Link>}
        </div>
        <a className={styles.explore} href="#get-involved">{home.exploreLabel} <ArrowDown size={18}/></a>
      </header>
      <div className={styles.heroVisual}>
        {home.imageUrl ? <Image src={home.imageUrl} alt={home.imageAlt} width={800} height={560} loading="eager" unoptimized/> : <Garden/>}
      </div>
    </div>

    <Reveal className={styles.mission} aria-labelledby="mission-title">
      <div>
        <h2 id="mission-title">{home.missionTitle}</h2>
        <Link className="text-link" href="/about">{home.missionLinkLabel} <ArrowRight size={18}/></Link>
      </div>
      <div className={styles.missionCopy}>
        <p>{content.about.intro}</p>
        <p>{home.missionBody}</p>
      </div>
    </Reveal>

    <section className={styles.involvement} id="get-involved" aria-labelledby="involvement-title">
      <div className={styles.sectionHeading}>
        <h2 id="involvement-title">{home.involvementTitle}</h2>
      </div>
      <p className={styles.sectionIntro}>{home.involvementIntro}</p>
      <div className={styles.involvementGrid}>
        <div className={styles.participation}>
          <article className={styles.readInvitation}>
            <div>
              <h3>{home.primaryLabel}</h3>
              <p>{content.stories.intro}</p>
              <Link className="text-link" href={home.primaryHref}>{reader.allStoriesLabel} <ArrowRight size={18}/></Link>
            </div>
            <Image src="/illustrations/education.svg" alt="" width={800} height={560} unoptimized/>
          </article>
          {visibility.homeWrite && <article className={styles.writeInvitation}>
            <h3>{home.writeTitle}</h3>
            <p>{home.writeDescription}</p>
            <Link className="text-link" href={home.writeLinkHref}>{home.writeLinkLabel} <ArrowRight size={18}/></Link>
          </article>}
        </div>
        {visibility.homeEvent && <section className={styles.event} aria-labelledby="next-event-title">
          <h3 id="next-event-title">{home.eventLabel}</h3>
          {nextEvent ? <>
            <h4>{nextEvent.title}</h4>
            <div className={styles.eventDetails}>
              <p><CalendarDays size={18}/><time dateTime={nextEvent.starts_at}>{eventDate(nextEvent.starts_at, nextEvent.all_day)}</time></p>
              <EventRecurrence event={nextEvent}/>
              <LocationLink location={location}/>
            </div>
            {nextEvent.is_sample && <p className={styles.sampleNote}>Sample event. Details are for demonstration.</p>}
          </> : <><h4>{home.eventEmptyTitle}</h4><p>{home.eventEmptyBody}</p></>}
          <div className={styles.eventActions}>
            <EventJoinLink href={nextEvent?.join_url} label={content.events.joinLabel}/>
            <Link href={nextEvent && home.eventLinkHref === '/events' ? `/events#event-${nextEvent.id}` : home.eventLinkHref} className="text-link">{home.eventLinkLabel} <ArrowRight size={17}/></Link>
            <a href={googleCalendarHref} className="text-link" target="_blank" rel="noopener noreferrer">Google Calendar <ArrowUpRight size={16}/></a>
          </div>
        </section>}
      </div>
    </section>

    {visibility.homeFeatured && (featured ? <section className={styles.feature} aria-labelledby="featured-title">
      <div className={styles.featureCopy}>
        <h2 id="featured-title"><Link href={`/post/${featured.slug}`}>{featured.headline}</Link></h2>
        <div className={styles.kicker}>
          <Link href={`/topic/${featured.topic.slug}`}>{featured.topic.name}</Link>
          <PublicationLabel sample={featured.is_sample}/>
        </div>
        <p>{featured.short_version}</p>
        <Author avatar={featured.writer?.avatar_url} name={featured.byline} date={featured.published_at} href={featured.writer ? `/writer/${featured.writer.slug}` : undefined}/>
        <Link className={styles.readLink} href={`/post/${featured.slug}`}>{reader.readStory} <ArrowRight size={18}/></Link>
      </div>
      <Link href={`/post/${featured.slug}`} className={`${styles.featureVisual} topic-color-${featured.topic.slug}`} tabIndex={-1} aria-hidden="true">
        <Image src={coverFor(featured)} alt={coverAlt(featured)} className={featured.cover_url ? undefined : styles.featureArtwork} width={800} height={560} loading="eager" unoptimized/>
      </Link>
    </section> : <section className={`empty-state ${styles.featureEmpty}`}>
      <h2>{home.emptyTitle}</h2>
      <p>{home.emptyBody}</p>
      <Link className="button" href="/write">{home.emptyLinkLabel} <ArrowRight size={18}/></Link>
    </section>)}

    {visibility.homeRecent && stories.length > 1 && <Reveal className={styles.recent} aria-labelledby="recent-heading">
      <div className={styles.sectionHeading}>
        <h2 id="recent-heading">{home.recentTitle}</h2>
        <Link href="/latest">{home.allStoriesLabel} <ArrowRight size={16}/></Link>
      </div>
      <div className="story-grid">{stories.slice(1, 4).map(story => <StoryCard key={story.id} story={story} headingLevel={3}/>)}</div>
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

    <Reveal className={styles.community} aria-labelledby="community-title">
      <div><h2 id="community-title">{home.communityTitle}</h2><p>{home.communityBody}</p></div>
      <div className={styles.communityActions}>
        <a className="button button-light" href={content.about.socialHref} target="_blank" rel="noopener noreferrer">{content.about.socialLabel} <ArrowUpRight size={17}/><span className="sr-only"> (opens in a new tab)</span></a>
        <a className="text-link" href={`mailto:${content.branding.contactEmail}`}>{content.navigation.contactLabel} <ArrowRight size={17}/></a>
      </div>
    </Reveal>
  </div>;
}
