import {describe,it,expect} from 'vitest';
import {assertOrigin,limitedJson,safeEqual,privateHash} from '@/lib/security';
import {site} from '@/lib/config';
describe('request security',()=>{
 it('requires the configured same origin',()=>{expect(()=>assertOrigin(new Request(site.url,{headers:{origin:new URL(site.url).origin}}))).not.toThrow();for(const origin of ['https://evil.example','null',''])expect(()=>assertOrigin(new Request(site.url,{headers:{origin}}))).toThrow();});
 it('rejects cross site metadata',()=>expect(()=>assertOrigin(new Request(site.url,{headers:{origin:new URL(site.url).origin,'sec-fetch-site':'cross-site'}}))).toThrow());
 it('caps streamed request bodies regardless of length headers',async()=>await expect(limitedJson(new Request(site.url,{method:'POST',body:JSON.stringify({body:'x'.repeat(100)})}),20)).rejects.toThrow('too large'));
 it('hashes identities without retaining them',()=>{const value=privateHash('1.2.3.4','a'.repeat(64));expect(value).toMatch(/^[a-f0-9]{64}$/);expect(value).not.toContain('1.2.3.4');});
 it('rejects unequal and mismatched size tokens',()=>{expect(safeEqual('abc','abc')).toBe(true);expect(safeEqual('abc','abcd')).toBe(false);expect(safeEqual('abc','xyz')).toBe(false);});
});
