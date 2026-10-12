import Image from 'next/image';
import Link from 'next/link';
import { site } from '@/lib/config';

export function Footer() {
  return <footer className="site-footer">
    <div className="container footer-bar">
      <Link className="footer-brand" href="/" aria-label="Illinois Abundance home"><Image src="/brand/logo-wordmark-horizontal.png" alt="Illinois Abundance" width={1439} height={132} sizes="(max-width: 767px) 150px, 190px"/></Link>
      <nav className="footer-links" aria-label="Footer"><a href={`mailto:${site.contact}`}>Contact</a><Link href="/login">Reviewer sign in</Link><Link href="/login/admin">Admin sign in</Link></nav>
    </div>
  </footer>;
}
