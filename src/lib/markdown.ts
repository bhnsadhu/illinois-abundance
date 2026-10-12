export type BodyBlock = { type: 'paragraph' | 'heading'; text: string };
/** Only paragraphs and ## subheads are supported. Render text through React escaping. */
export function parseBody(value: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => { if (paragraph.length) { blocks.push({ type: 'paragraph', text: paragraph.join(' ') }); paragraph = []; } };
  for (const line of value.replace(/\r\n/g, '\n').split('\n')) {
    if (!line.trim()) flush();
    else if (line.startsWith('## ')) { flush(); blocks.push({ type: 'heading', text: line.slice(3).trim() }); }
    else paragraph.push(line.trim());
  }
  flush(); return blocks;
}
