import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { SiteIntro, introScript } from '@/components/site-intro';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { site } from '@/lib/config';
import { getSiteContent } from '@/lib/site-content';
import { siteContentDefaults } from '@/lib/site-content-model';
import './globals.css';
import './editorial.css';
import './extras.css';
import './desk.css';
import './interactions.css';
export async function generateMetadata():Promise<Metadata> {
 const {branding}=await getSiteContent();
 const defaultIcon=!branding.faviconUrl||branding.faviconUrl===siteContentDefaults.branding.faviconUrl;
 return {metadataBase:new URL(site.url),title:{default:branding.name,template:`%s · ${branding.name}`},description:branding.description,icons:{icon:branding.faviconUrl||'/brand/favicon.svg',apple:defaultIcon?'/brand/apple-touch-icon.png?v=2':branding.faviconUrl,...(defaultIcon?{shortcut:'/brand/favicon.ico?v=2'}:{})},openGraph:{siteName:branding.name,locale:'en_US',type:'website',title:branding.shareTitle,description:branding.shareDescription}};
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#fffbe4' };
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { const {branding,navigation,visibility}=await getSiteContent(); return <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning><head><Script id="abundance-welcome" strategy="beforeInteractive">{introScript}</Script><link rel="preload" href="/fonts/DMSans-Variable.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/><link rel="preload" href="/fonts/PatrickHand-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/></head><body><SiteIntro name={branding.name}/><a className="skip-link" href="#main">Skip to content</a><Header branding={branding} navigation={navigation} visibility={visibility}/><main id="main" tabIndex={-1}>{children}</main><Footer branding={branding} navigation={navigation}/></body></html>; }
