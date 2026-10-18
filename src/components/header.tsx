'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Search } from './icons';
import { isPathHidden } from '@/hidden/features';
import { siteContentDefaults, contentVisibility, type SiteContent } from '@/lib/site-content-schema';


export function Header({branding=siteContentDefaults.branding,navigation=siteContentDefaults.navigation,visibility=siteContentDefaults.visibility}:{branding?:SiteContent['branding'];navigation?:SiteContent['navigation'];visibility?:SiteContent['visibility']}) {
  const hidden=contentVisibility({...siteContentDefaults,visibility});
  const links=navigation.links.filter(({href})=>!isPathHidden(href,hidden));
  const [open, setOpen] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setKeyboard(true); setOpen(false); menuButton.current?.focus(); }
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
  return <header className="site-header" data-input={keyboard ? 'keyboard' : 'pointer'} ref={header} onKeyDown={() => setKeyboard(true)} onPointerDown={() => setKeyboard(false)} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <div className="nav-wrap">
      <div className="masthead-brand">
        <Link className="wordmark" href="/" aria-label={`${branding.name} home`} onClick={() => setOpen(false)}>
          {branding.logoUrl?<Image src={branding.logoUrl} alt={branding.logoAlt} width={1439} height={132} sizes="(max-width: 767px) 195px, 225px" priority unoptimized/>:branding.name}
        </Link>
      </div>
      <nav className="desktop-nav" aria-label="Main navigation">{links.map(({label, href}) => <Link key={`${href}-${label}`} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}</nav>
      <div className="nav-actions">
        <Link href="/search" className="icon-button" aria-label="Search stories" onClick={() => setOpen(false)}><Search size={19}/></Link>
        <Link className="nav-write" href={navigation.writeHref}>{navigation.writeLabel}</Link>
        <button ref={menuButton} className="icon-button mobile-toggle" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={event => { setKeyboard(event.detail === 0); setOpen(value => !value); }}><span className="menu-glyph" aria-hidden="true"/></button>
      </div>
    </div>
    <nav id="mobile-nav" className="mobile-nav" data-open={open} inert={!open} aria-label="Mobile navigation">
      {links.map(({label, href}) => <Link key={`${href}-${label}`} href={href} aria-current={pathname === href ? 'page' : undefined} onClick={() => setOpen(false)}>{label}<ArrowRight size={16}/></Link>)}
      <Link href={navigation.writeHref} onClick={() => setOpen(false)}>{navigation.writeLabel} <ArrowRight size={16}/></Link>
    </nav>
  </header>;
}
