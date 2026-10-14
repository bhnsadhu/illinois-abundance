import Link from 'next/link';
import Image from 'next/image';
import { formatDate, initials } from '@/lib/format';

type AuthorProps = { name: string; avatar?:string|null; date?: string; href?: string; readTime?: number };

export function Author({ name, date, href, readTime, avatar }: AuthorProps) {
  const identity = <><span className="author-avatar" aria-hidden="true">{avatar?<Image src={avatar} alt="" width={32} height={32} unoptimized/>:initials(name)}</span><span className="author-name">{name}</span></>;
  return <div className="author">
    {href ? <Link className="author-identity" href={href}>{identity}</Link> : <span className="author-identity">{identity}</span>}
    {(date || readTime) && <span className="author-details">
      {date && <time dateTime={date}>{formatDate(date)}</time>}
      {date && readTime ? <span aria-hidden="true">·</span> : null}
      {readTime ? <span>{readTime} min read</span> : null}
    </span>}
  </div>;
}
