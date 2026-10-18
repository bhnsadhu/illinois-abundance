import { beforeEach, expect, it, vi } from 'vitest';
import { getEvents, getStory, getStories, getTopics, searchStories } from '@/lib/data';

const mocks = vi.hoisted(() => ({ query: vi.fn(), rpc: vi.fn() }));
vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn }));
vi.mock('@/lib/database/public', () => ({ publicDatabase: () => ({
  from: () => {
    const query = {
      select: () => query, order: () => query, eq: () => query,
      range: mocks.query, maybeSingle: mocks.query,
      then: (resolve: (result: unknown) => unknown) => Promise.resolve(mocks.query()).then(resolve),
    };
    return query;
  },
  rpc: mocks.rpc,
}) }));

beforeEach(() => {
  const failure = { data: null, error: { code: '08006', message: 'Private connection details' } };
  mocks.query.mockReset().mockResolvedValue(failure);
  mocks.rpc.mockReset().mockResolvedValue(failure);
});

it('surfaces outages for retry instead of caching empty directories or false 404s', async () => {
  for (const read of [getStories, getTopics, getEvents, () => getStory('existing-story'), () => searchStories('homes')]) {
    await expect(read()).rejects.toThrow('temporarily unavailable');
  }
});

it('still returns a genuine not-found result when the lookup succeeds without a story', async () => {
  mocks.query.mockResolvedValue({ data: null, error: null });
  expect(await getStory('missing-story')).toBeUndefined();
});
