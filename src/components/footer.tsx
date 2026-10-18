import Image from 'next/image';
import Link from 'next/link';
import { GardenBorder } from './garden-border';
import { siteContentDefaults, type SiteContent } from '@/lib/site-content-model';

export function Footer({branding=siteContentDefaults.branding,navigation=siteContentDefaults.navigation}:{branding?:SiteContent['branding'];navigation?:SiteContent['navigation']}) {
  return <footer className="site-footer">
    <GardenBorder/>
    <div className="container footer-bar">
      <Link className="footer-brand" href="/" aria-label={`${branding.name} home`}>{branding.logoUrl?<Image src={branding.logoUrl} alt={branding.logoAlt} width={1439} height={132} sizes="(max-width: 767px) 150px, 190px" unoptimized/>:branding.name}</Link>
      <nav className="footer-links" aria-label="Footer">{navigation.footerLinks.map(link=><Link key={`${link.href}-${link.label}`} href={link.href}>{link.label}</Link>)}<a href={`mailto:${branding.contactEmail}`}>{navigation.contactLabel}</a><Link href="/login">{navigation.reviewerLabel}</Link><Link href="/login/admin">{navigation.adminLabel}</Link></nav>
    </div>
  </footer>;
}
