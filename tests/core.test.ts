import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { BodyText } from '@/components/body-text';
import { parseBody } from '@/lib/markdown';
import { slugify, safeUrl, csvCell } from '@/lib/format';
import { generateCode, hashCode, matchesCode, codeState } from '@/lib/codes';
describe('verification codes', () => {
 const pepper = 'a'.repeat(64);
 it('creates exactly six numeric digits', () => { for(let i=0;i<25;i++) expect(generateCode()).toMatch(/^\d{6}$/); });
 it('binds a hash to the challenge and pepper', () => { const hash = hashCode('id','123456',pepper); expect(hash).not.toContain('123456'); expect(matchesCode(hash,hashCode('id','123456',pepper))).toBe(true); expect(matchesCode(hash,hashCode('id2','123456',pepper))).toBe(false); expect(matchesCode(hash,hashCode('id','123456','b'.repeat(64)))).toBe(false); });
 it('rejects malformed hashes and weak peppers', () => { expect(matchesCode('not-a-hash','not-a-hash')).toBe(false); expect(()=>hashCode('id','123456','short')).toThrow(); });
 it('expires exactly at the deadline and caps attempts', () => { const expiry='2026-10-12T12:00:00Z'; expect(codeState(expiry,4,Date.parse(expiry)-1)).toBe('valid'); expect(codeState(expiry,4,Date.parse(expiry))).toBe('expired'); expect(codeState(expiry,5,Date.parse(expiry)-1)).toBe('locked'); expect(codeState('invalid',0)).toBe('expired'); });
});
describe('safe publishing helpers',()=>{
 it('makes stable slugs',()=>{expect(slugify('Héllo, Champaign!')).toBe('hello-champaign');expect(slugify('🏡')).toBe('a-new-idea');});
 it('supports only paragraphs and subheads',()=>expect(parseBody('Hello\nworld\n\n## A question?\nYes.')).toEqual([{type:'paragraph',text:'Hello world'},{type:'heading',text:'A question?'},{type:'paragraph',text:'Yes.'}]));
 it('escapes scripts and arbitrary HTML',()=>{const html=renderToStaticMarkup(createElement(BodyText,{body:'<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>'}));expect(html).not.toContain('<script>');expect(html).not.toContain('<img');expect(html).toContain('&lt;script&gt;');});
 it('rejects unsafe source URLs',()=>{expect(safeUrl('javascript:alert(1)')).toBeNull();expect(safeUrl('https://example.org')).toBe('https://example.org/');});
 it('neutralizes CSV spreadsheet formulas',()=>expect(csvCell('=HYPERLINK("evil")')).toBe('"\'=HYPERLINK(""evil"")"'));
});
