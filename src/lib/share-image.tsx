import 'server-only';
import React from 'react';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { fitHeadline, type FontMetrics, type ShareContent } from './share-content';

export type ShareFormat = 'opengraph' | 'instagram';
const colors = { background: '#FFFBE4', ink: '#202722', teal: '#244E49', muted: '#5B635E' };
const topics = ['housing', 'infrastructure', 'energy', 'healthcare', 'education', 'technology'];
const asset = (...path: string[]) => join(process.cwd(), 'public', ...path);

// Assets are local, immutable, and loaded once per server instance. Never fetch a
// cover URL or use the original logo, which contains figures outside the wordmark.
const assets = Promise.all([
  readFile(asset('fonts', 'PatrickHand-Regular.ttf')),
  readFile(asset('fonts', 'PatrickHand-metrics.json'), 'utf8'),
  readFile(asset('fonts', 'DMSans-Regular.ttf')),
  readFile(asset('fonts', 'DMSans-metrics.json'), 'utf8'),
  readFile(asset('brand', 'logo-wordmark-horizontal.png'), 'base64'),
  Promise.all(topics.map(async topic => [topic, await readFile(asset('illustrations', `${topic}.svg`), 'base64')] as const)),
]).then(([heading, headingMetrics, body, metrics, wordmark, illustrations]) => ({
  fonts: [
    { name: 'Patrick Hand', data: Uint8Array.from(heading).buffer, weight: 400 as const, style: 'normal' as const },
    { name: 'DM Sans', data: Uint8Array.from(body).buffer, weight: 400 as const, style: 'normal' as const },
  ],
  headingMetrics: JSON.parse(headingMetrics) as FontMetrics,
  metrics: JSON.parse(metrics) as FontMetrics,
  wordmark: `data:image/png;base64,${wordmark}`,
  illustrations: Object.fromEntries(illustrations.map(([topic, svg]) => [topic, `data:image/svg+xml;base64,${svg}`])),
}));

export async function createShareImage(content: ShareContent, format: ShareFormat, headers?: Record<string, string>) {
  const { fonts, headingMetrics, metrics, wordmark, illustrations } = await assets;
  const portrait = format === 'instagram';
  const width = portrait ? 1080 : 1200;
  const height = portrait ? 1350 : 630;
  const titleWidth = portrait ? 940 : 610;
  const titleHeight = portrait ? 380 : 304;
  const title = fitHeadline(content.headline, titleWidth, titleHeight, portrait ? 112 : 88, headingMetrics);
  const illustration = illustrations[content.topicSlug] || illustrations.housing;
  const author = content.isSite ? content.author : `Written by ${content.author}`;
  const byline = fitHeadline(author, portrait ? 940 : 1088, portrait ? 86 : 52, portrait ? 29 : 21, metrics, 1.3, 12);
  const topic = fitHeadline(content.topic, titleWidth, portrait ? 43 : 39, portrait ? 24 : 21, metrics, 1.15, 12);
  return new ImageResponse(
    <div style={{ display: 'flex', position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: colors.background, color: colors.ink, fontFamily: 'DM Sans' }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders raster output, not a browser page. */}
      <img src={wordmark} alt="Illinois Abundance" width={portrait ? 450 : 360} height={(portrait ? 450 : 360) * 132 / 1439} style={{ position: 'absolute', left: portrait ? 70 : 56, top: portrait ? 65 : 48 }}/>
      {content.isSample && <div style={{ display: 'flex', position: 'absolute', right: portrait ? 70 : 56, top: portrait ? 78 : 53, fontSize: portrait ? 19 : 16, color: colors.muted }}>Sample story</div>}
      <div style={{ display: 'flex', flexDirection: 'column', position: 'absolute', left: portrait ? 70 : 56, top: portrait ? 166 : 137, maxWidth: titleWidth, fontSize: topic.fontSize, color: colors.teal }}>
        {topic.lines.map((line, index) => <div key={index} style={{ display: 'flex', height: topic.lineHeight, whiteSpace: 'nowrap' }}>{line}</div>)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', position: 'absolute', left: portrait ? 70 : 56, top: portrait ? 217 : 182, width: titleWidth, fontFamily: 'Patrick Hand', fontWeight: 400, fontSize: title.fontSize, lineHeight: 1.12 }}>
        {title.lines.map((line, index) => <div key={index} style={{ display: 'flex', height: title.lineHeight, whiteSpace: 'nowrap' }}>{line}</div>)}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- Local SVG embedded directly for a self-contained image renderer. */}
      <img src={illustration} alt="" width={portrait ? 830 : 505} height={(portrait ? 830 : 505) * .7} style={{ position: 'absolute', left: portrait ? 125 : 656, top: portrait ? 615 : 156 }}/>
      <div style={{ display: 'flex', position: 'absolute', left: portrait ? 70 : 56, right: portrait ? 70 : 56, top: portrait ? 1210 : 543, paddingTop: portrait ? 26 : 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: portrait ? 940 : 1088, fontSize: byline.fontSize, color: colors.muted }}>
          {byline.lines.map((line, index) => <div key={index} style={{ display: 'flex', height: byline.lineHeight, whiteSpace: 'nowrap' }}>{line}</div>)}
        </div>
      </div>
    </div>,
    { width, height, fonts, headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=60', ...headers } },
  );
}
