import type { MetadataRoute } from 'next';
import { site } from '@/lib/config';
export default function robots():MetadataRoute.Robots {
  return {rules:{userAgent:'*',allow:'/',disallow:['/admin','/api/','/review','/login','/auth/','/search','/write/verify','/subscribe/confirm','/unsubscribe']},sitemap:new URL('/sitemap.xml',site.url).toString()};
}
