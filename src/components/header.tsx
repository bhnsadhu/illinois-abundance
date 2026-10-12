'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Search, Menu, X } from './icons';

const links = [['Latest', '/latest'], ['Learn', '/learn'], ['Events', '/events'], ['Show up', '/show-up'], ['About', '/about']];

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return <header className="site-header">
    <div className="nav-wrap">
      <div className="masthead-brand">
        <Link className="wordmark" href="/" aria-label="Illinois Abundance home" onClick={() => setOpen(false)}>
          <Image src="/brand/logo-wordmark-horizontal.png" alt="Illinois Abundance" width={1439} height={132} sizes="(max-width: 767px) 210px, 290px" priority/>
        </Link>
      </div>
      <nav className="desktop-nav" aria-label="Main navigation">{links.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}</nav>
      <div className="nav-actions">
        <Link href="/search" className="icon-button" aria-label="Search stories"><Search size={19}/></Link>
        <Link className="nav-write" href="/write">Write for us</Link>
        <button className="icon-button mobile-toggle" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button>
      </div>
    </div>
    {open && <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile navigation">
      {links.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined} onClick={() => setOpen(false)}>{label}<ArrowRight size={16}/></Link>)}
      <Link href="/write" onClick={() => setOpen(false)}>Write for us <ArrowRight size={16}/></Link>
    </nav>}
  </header>;
}
