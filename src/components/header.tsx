'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Search, Menu, X } from './icons';
import { isPathHidden } from '@/hidden/features';

const links = [['Stories', '/latest'], ['Learn', '/learn'], ['Events', '/events'], ['Show up', '/show-up'], ['About', '/about']].filter(([, href]) => !isPathHidden(href));

export function Header() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus(); }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) setOpen(false);
    };
    const desktop = window.matchMedia('(min-width: 901px)');
    const onResize = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    desktop.addEventListener('change', onResize);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      desktop.removeEventListener('change', onResize);
    };
  }, [open]);
  return <header className="site-header" ref={header} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <div className="nav-wrap">
      <div className="masthead-brand">
        <Link className="wordmark" href="/" aria-label="Illinois Abundance home" onClick={() => setOpen(false)}>
          <Image src="/brand/logo-wordmark-horizontal.png" alt="Illinois Abundance" width={1439} height={132} sizes="(max-width: 767px) 195px, 225px" priority/>
        </Link>
      </div>
      <nav className="desktop-nav" aria-label="Main navigation">{links.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}</nav>
      <div className="nav-actions">
        <Link href="/search" className="icon-button" aria-label="Search stories" onClick={() => setOpen(false)}><Search size={19}/></Link>
        <Link className="nav-write" href="/write">Write for us</Link>
        <button ref={menuButton} className="icon-button mobile-toggle" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>{open ? <X size={20}/> : <Menu size={20}/>}</button>
      </div>
    </div>
    <nav id="mobile-nav" className="mobile-nav" data-open={open} inert={!open} aria-label="Mobile navigation">
      {links.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined} onClick={() => setOpen(false)}>{label}<ArrowRight size={16}/></Link>)}
      <Link href="/write" onClick={() => setOpen(false)}>Write for us <ArrowRight size={16}/></Link>
    </nav>
  </header>;
}
