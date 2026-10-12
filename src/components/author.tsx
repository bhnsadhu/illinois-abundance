import Link from 'next/link';
import { formatDate, initials } from '@/lib/format';

type AuthorProps = { name: string; date?: string; href?: string; readTime?: number };

export function Author({ name, date, href, readTime }: AuthorProps) {
  const identity = <><span className="author-avatar" aria-hidden="true">{initials(name)}</span><span className="author-name">{name}</span></>;
  return <div className="author">
    {href ? <Link className="author-identity" href={href}>{identity}</Link> : <span className="author-identity">{identity}</span>}
    {(date || readTime) && <span className="author-details">
      {date && <time dateTime={date}>{formatDate(date)}</time>}
      {date && readTime ? <span aria-hidden="true">·</span> : null}
      {readTime ? <span>{readTime} min read</span> : null}
    </span>}
  </div>;
}
