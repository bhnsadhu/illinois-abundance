import { describe, it, expect } from 'vitest';
import { site, samplesEnabled } from '@/lib/config';
describe('public configuration', () => {
  it('uses a valid site origin for metadata', () => expect(new URL(site.url).origin).toBeTruthy());
  it('does not enable sample content implicitly', () => expect(samplesEnabled()).toBe(false));
  it('does not expose secrets through public configuration', () => expect(Object.keys(site)).toEqual(['name', 'description', 'url', 'contact']));
});
