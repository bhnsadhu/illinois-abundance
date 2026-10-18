import { describe, it, expect } from 'vitest';
import { site, samplesEnabled } from '@/lib/config';
import nextConfig from '../next.config';
describe('public configuration', () => {
  it('uses a valid site origin for metadata', () => expect(new URL(site.url).origin).toBeTruthy());
  it('does not enable sample content implicitly', () => expect(samplesEnabled()).toBe(false));
  it('does not expose secrets through public configuration', () => expect(Object.keys(site)).toEqual(['name', 'description', 'url', 'contact']));
  it('allows local photo previews while restricting image sources and framing', async () => {
    const headers = (await nextConfig.headers!())[0].headers;
    const csp = headers.find(header => header.key === 'Content-Security-Policy')!.value;
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
  });
});
