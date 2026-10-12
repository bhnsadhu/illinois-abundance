'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ArrowUpRight, Search, Menu, X } from './icons';
const links = [['Latest', '/latest'], ['Learn', '/learn'], ['Events', '/events'], ['Show up', '/show-up'], ['About', '/about']];
export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return <header className="site-header"><div className="nav-wrap"><Link className="wordmark" href="/" aria-label="Illinois Abundance home" onClick={() => setOpen(false)}><Image src="/brand/logo-wordmark.png" alt="Illinois Abundance" width={190} height={72} priority /></Link><nav className="desktop-nav" aria-label="Main navigation">{links.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}</nav><div className="nav-actions"><Link href="/search" className="icon-button" aria-label="Search stories"><Search size={20}/></Link><Link className="button button-small nav-write" href="/write">Write for us <ArrowUpRight size={16}/></Link><button className="icon-button mobile-toggle" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button></div></div>{open && <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile navigation">{links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}<ArrowUpRight size={18}/></Link>)}<Link href="/write" onClick={() => setOpen(false)}>Write for us <ArrowUpRight size={18}/></Link></nav>}</header>;
}
