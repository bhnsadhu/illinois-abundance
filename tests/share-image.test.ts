import { beforeEach, describe, expect, it, vi } from 'vitest';
import metrics from '../public/fonts/PatrickHand-metrics.json';
import bodyMetrics from '../public/fonts/DMSans-metrics.json';
import { fitHeadline, shareContent, textWidth } from '@/lib/share-content';
import { samplePosts, sampleTopics, sampleWriters } from '@/lib/sample-data';
import type { Story } from '@/lib/types';

vi.mock('@/lib/data', () => ({ getStory: vi.fn() }));
vi.mock('@/lib/share-image', () => ({ createShareImage: vi.fn(async () => new Response('image', { headers: { 'Content-Type': 'image/png' } })) }));
import { getStory } from '@/lib/data';
import { createShareImage } from '@/lib/share-image';
import OpenGraphImage from '@/app/post/[slug]/opengraph-image';
import { GET as instagramImage } from '@/app/post/[slug]/share.png/route';

const story: Story = { ...samplePosts[0], topic: sampleTopics[0], writer: sampleWriters[0] };
beforeEach(() => vi.clearAllMocks());

describe('public share images', () => {
  it('allows only visible public title, byline, topic, and sample state into the renderer', async () => {
    const polluted = { ...story, author_email: 'private@example.test', original_body: 'PRIVATE ORIGINAL', claimed_by: 'PRIVATE REVIEWER', decline_note: 'PRIVATE NOTE', subscribers: ['PRIVATE SUBSCRIBER'] };
    vi.mocked(getStory).mockResolvedValue(polluted);
    await OpenGraphImage({ params: Promise.resolve({ slug: story.slug }) });
    const data = vi.mocked(createShareImage).mock.calls[0][0];
    expect(data).toEqual({ headline: story.headline, author: story.byline, topic: story.topic.name, topicSlug: story.topic.slug, isSample: true });
    expect(JSON.stringify(data)).not.toMatch(/PRIVATE|private@example/);
    expect(shareContent({ ...story, byline: '' }).author).toBe(story.author_name);
  });

  it('returns an uncacheable 404 when the public loader withholds a draft or removed story', async () => {
    vi.mocked(getStory).mockResolvedValue(undefined);
    const params = Promise.resolve({ slug: 'unpublished-story' });
    for (const response of [await OpenGraphImage({ params }), await instagramImage(new Request('http://localhost/post/unpublished-story/share.png'), { params })]) {
      expect(response.status).toBe(404);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
    expect(createShareImage).not.toHaveBeenCalled();
  });

  it('uses an attachment filename that cannot inject HTTP headers', async () => {
    vi.mocked(getStory).mockResolvedValue({ ...story, slug: 'a-story\r\nInjected: value' });
    await instagramImage(new Request('http://localhost/post/a-story/share.png'), { params: Promise.resolve({ slug: 'a-story' }) });
    expect(createShareImage).toHaveBeenCalledWith(shareContent(story), 'instagram', { 'Content-Disposition': 'attachment; filename="a-storyInjectedvalue.png"' });
  });
});

describe('headline fitting', () => {
  it('also contains the longest allowed unbroken byline and topic', () => {
    for (const [text, width, height, maximum, ratio] of [
      [`Written by ${'W'.repeat(160)}`, 1088, 52, 21, 1.3],
      [`Written by ${'W'.repeat(160)}`, 940, 86, 29, 1.3],
      ['W'.repeat(80), 610, 39, 21, 1.15],
      ['W'.repeat(80), 940, 43, 24, 1.15],
    ] as const) {
      const result = fitHeadline(text, width, height, maximum, bodyMetrics, ratio, 12);
      expect(result.lines.length * result.lineHeight).toBeLessThanOrEqual(height);
      result.lines.forEach(line => expect(textWidth(line, result.fontSize, bodyMetrics)).toBeLessThanOrEqual(width));
      expect(result.lines.join('').replace(/\s/g, '')).toBe(text.replace(/\s/g, ''));
    }
  });
  for (const headline of ['Let’s make room for more neighbors.', 'W'.repeat(200), 'More welcoming neighborhoods need room for homes, useful shops, comfortable sidewalks, and the public places that give everyone a reason to stay. What would it take to build that kind of future together?'.slice(0, 200)]) {
    it(`keeps all ${headline.length} characters within both image layouts`, () => {
      for (const [width, height, maximum] of [[610, 304, 88], [940, 380, 112]]) {
        const result = fitHeadline(headline, width, height, maximum, metrics);
        expect(result.lines.length * result.lineHeight).toBeLessThanOrEqual(height);
        result.lines.forEach(line => expect(textWidth(line, result.fontSize, metrics)).toBeLessThanOrEqual(width));
        expect(result.lines.join('').replace(/\s/g, '')).toBe(headline.replace(/\s/g, ''));
      }
    });
  }
});
