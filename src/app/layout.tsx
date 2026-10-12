import type { Metadata, Viewport } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { site } from '@/lib/config';
import './globals.css';
import './editorial.css';
import './extras.css';
export const metadata: Metadata = {
  metadataBase: new URL(site.url), title: { default: 'Illinois Abundance · A little more possibility', template: '%s · Illinois Abundance' }, description: site.description,
  icons: { icon: '/brand/favicon.png', apple: '/brand/apple-touch-icon.png' },
  openGraph: { siteName: site.name, locale: 'en_US', type: 'website', title: site.name, description: site.description },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#FFFBE4' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a><Header/><main id="main">{children}</main><Footer/></body></html>; }
