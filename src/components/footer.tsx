import Image from 'next/image';
import Link from 'next/link';
import { content } from '@/lib/content';
import { site } from '@/lib/config';

export function Footer() {
  return <footer className="site-footer">
    <div className="container footer-top">
      <div>
        <Link href="/" aria-label="Illinois Abundance home"><Image src="/brand/logo-wordmark-horizontal.png" alt="Illinois Abundance" width={1439} height={132} sizes="250px"/></Link>
        <p>{content.footer}</p>
      </div>
      <div className="footer-links"><Link href="/about">About the group</Link><Link href="/write">Write for us</Link><a href={`mailto:${site.contact}`}>Contact us</a><Link href="/rss.xml">RSS feed</Link></div>
    </div>
    <div className="container footer-bottom"><span>© {new Date().getFullYear()} Illinois Abundance</span><span>A student group at the University of Illinois Urbana Champaign.</span><Link href="/login">Reviewer &amp; admin sign in</Link></div>
  </footer>;
}
