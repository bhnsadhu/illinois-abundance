import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from '@/components/icons';
import { getSiteContent } from '@/lib/site-content';
import styles from './page.module.css';

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { home } = await getSiteContent();
  return { title: 'News', description: home.newsIntro, alternates: { canonical: '/news' } };
}

export default async function NewsPage() {
  const { home } = await getSiteContent();
  return <div className="container editorial-index">
    <header className="page-heading">
      <h1>{home.newsTitle}</h1>
      <p>{home.newsIntro}</p>
    </header>
    {home.newsItems.length ? <div className={styles.list}>
      {home.newsItems.map((item, index) => <article className={styles.item} key={`${item.href}-${index}`}>
        <div className={styles.copy}>
          <h2><a href={item.href} target="_blank" rel="noopener noreferrer" aria-label={`${item.title} (opens in a new tab)`}>{item.title} <ArrowUpRight size={20}/></a></h2>
          <p>{item.description}</p>
        </div>
        <div className={styles.source}><span>{item.publisher}</span><span>{item.dateLabel}</span></div>
      </article>)}
    </div> : <section className="empty-state">
      <h2>More local news soon.</h2>
      <p>We’ll share selected reporting here as we find it.</p>
      <Link className="text-link" href="/latest">Read student stories <ArrowRight size={18}/></Link>
    </section>}
  </div>;
}
