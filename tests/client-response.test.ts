import { expect, it } from 'vitest';
import { readApiResponse } from '@/lib/client-response';

it('keeps useful API errors and successful results intact', async () => {
  expect(await readApiResponse(Response.json({ error: 'That code has expired.' }, { status: 400 }))).toEqual({ error: 'That code has expired.' });
  expect(await readApiResponse(Response.json({ ok: true, version: 2 }))).toEqual({ ok: true, version: 2 });
});

it('turns a gateway outage or malformed response into actionable feedback', async () => {
  for (const body of ['<html>Bad gateway</html>', '', 'null', '[]', '"unavailable"']) {
    await expect(readApiResponse(new Response(body, { status: 502 }))).rejects.toThrow('Please try again in a moment.');
  }
});
