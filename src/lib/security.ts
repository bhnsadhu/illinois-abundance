import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { serviceDatabase } from '@/lib/database/service';
import { site } from './config';
export function secret(name: 'CODE_PEPPER' | 'VIEW_SALT') { const value = process.env[name]; if(!value || value.length < 32) throw new Error('This service is not configured yet. Please try again soon.'); return value; }
export function privateHash(value: string, salt = secret('CODE_PEPPER')) { return createHmac('sha256',salt).update(value).digest('hex'); }
export function newToken() { return randomBytes(32).toString('hex'); }
export function safeEqual(a: string, b: string) { const first=Buffer.from(a), second=Buffer.from(b); return first.length===second.length && timingSafeEqual(first,second); }
/** Bind mutating browser requests to our exact configured origin. */
export function assertOrigin(request: Request) { const origin=request.headers.get('origin'); const expected=new URL(site.url).origin; if(!origin || origin !== expected) throw new Error('Refresh the page and try again.'); const fetchSite=request.headers.get('sec-fetch-site'); if(fetchSite && !['same-origin','none'].includes(fetchSite))throw new Error('Refresh the page and try again.'); }
export function requestIp(request: Request) { // Vercel overwrites x-forwarded-for; local dev shares one bucket.
 return process.env.VERCEL ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown' : 'local';
}
export async function rateLimit(scope: string, identity: string, limit: number, seconds: number) { const {data,error}=await serviceDatabase().rpc('consume_rate_limit',{p_key:`${scope}:${privateHash(identity)}`,p_limit:limit,p_window_seconds:seconds}); if(error) throw new Error('Please try again in a moment.'); if(data!==true) throw new Error('A few too many tries. Please wait a little and try again.'); }
export async function limitedJson(request: Request, maxBytes = 90_000): Promise<unknown> { if(Number(request.headers.get('content-length')||0)>maxBytes)throw new Error('That request is too large.'); const reader=request.body?.getReader(); if(!reader)throw new Error('Please complete the form.'); const chunks:Uint8Array[]=[];let length=0;while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>maxBytes){await reader.cancel();throw new Error('That request is too large.');}chunks.push(value);}const body=Buffer.concat(chunks);try{return JSON.parse(body.toString('utf8'));}catch{throw new Error('Please complete the form and try again.');} }
