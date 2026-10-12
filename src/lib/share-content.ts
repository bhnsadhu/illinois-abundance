import type { Story } from './types';

export type ShareContent = {
  headline: string;
  author: string;
  topic: string;
  topicSlug: string;
  isSample: boolean;
  isSite?: boolean;
};

/** Explicit allowlist: no submission, contact, or internal review data travels to a renderer. */
export function shareContent(story: Story): ShareContent {
  return {
    headline: story.headline,
    author: story.byline || story.author_name,
    topic: story.topic.name,
    topicSlug: story.topic.slug,
    isSample: story.is_sample,
  };
}

export type FontMetrics = { unitsPerEm: number; advances: Record<string, number> };
export function textWidth(text: string, fontSize: number, metrics: FontMetrics) {
  return [...text].reduce((total, char) => total + (metrics.advances[String(char.codePointAt(0))] ?? metrics.unitsPerEm), 0) * fontSize / metrics.unitsPerEm;
}

function wrapHeadline(text: string, fontSize: number, width: number, metrics: FontMetrics) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/)) {
    const combined = line ? `${line} ${word}` : word;
    if (textWidth(combined, fontSize, metrics) <= width) { line = combined; continue; }
    if (line) { lines.push(line); line = ''; }
    for (const character of word) {
      if (line && textWidth(line + character, fontSize, metrics) > width) { lines.push(line); line = ''; }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Fit actual glyph advances, including long unbroken headlines, without truncating words. */
export function fitHeadline(text: string, width: number, height: number, maximum: number, metrics: FontMetrics, lineRatio = 1.12, minimum = 18) {
  for (let fontSize = maximum; fontSize >= minimum; fontSize -= 2) {
    const lines = wrapHeadline(text, fontSize, width - 8, metrics);
    const lineHeight = Math.ceil(fontSize * lineRatio);
    if (lines.length * lineHeight <= height) return { lines, fontSize, lineHeight };
  }
  const fontSize = minimum;
  return { lines: wrapHeadline(text, fontSize, width - 8, metrics), fontSize, lineHeight: Math.ceil(fontSize * lineRatio) };
}
