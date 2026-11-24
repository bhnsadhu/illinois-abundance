import type { MetadataRoute } from 'next';
import { site } from '@/lib/config';

// AI training and bulk-scrape crawlers: blocked entirely.
const BLOCKED_BOTS = [
  'GPTBot',
  'meta-externalagent',
  'meta-webindexer',
  'FacebookBot',
  'CCBot',
  'ClaudeBot',
  'anthropic-ai',
  'Bytespider',
  'Amazonbot',
  'Applebot-Extended',
  'Google-Extended',
  'cohere-ai',
  'Diffbot',
  'ImagesiftBot',
  'omgili',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: BLOCKED_BOTS, disallow: '/' },
      { userAgent: '*', allow: '/', disallow: ['/account', '/admin', '/api/', '/review', '/login', '/auth/', '/search', '/latest?*', '/write/verify', '/subscribe/confirm', '/unsubscribe'] },
    ],
    sitemap: new URL('/sitemap.xml', site.url).toString(),
  };
}
