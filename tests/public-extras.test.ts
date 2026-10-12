import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDatabase } from '@/lib/database/client';
import { getAllStories, getTopicStories, getWriterStories, searchStories } from '@/lib/data';
import { GET as rss } from '@/app/rss.xml/route';
import { GET as calendar } from '@/app/events/[id]/calendar.ics/route';
import sitemap from '@/app/sitemap';
import { calendarText, eventCalendar, foldCalendarLine, storyFeed } from '@/lib/syndication';
import type { Event, Story } from '@/lib/types';

const mocks=vi.hoisted(()=>({neon:vi.fn()}));
vi.mock('@neondatabase/serverless',()=>({neon:mocks.neon}));
vi.mock('react',()=>({cache:(fn:unknown)=>fn}));
vi.mock('next/cache',()=>({unstable_cache:(fn:unknown)=>fn}));
type Statement={text:string;values:unknown[]};
let db:PGlite;
const statements:Statement[]=[];
const topic='10000000-0000-4000-8000-000000000001';
const writer='20000000-0000-4000-8000-000000000001';
const eventId='40000000-0000-4000-8000-000000000001';
const privateEvent='40000000-0000-4000-8000-000000000002';
const url='postgresql://test:test@localhost/test';

function transport() {
  const query=(text:string,values:unknown[]=[])=>({text,values});
  return {query,async transaction(work:(transaction:{query:typeof query})=>Statement[],options:{readOnly:boolean}) {
    expect(options.readOnly).toBe(true);
    const queries=work({query});
    expect(queries[0].text).toBe('SET LOCAL ROLE anon');
    return db.transaction(async transaction=>{
      await transaction.exec('SET TRANSACTION READ ONLY');
      const results=[];
      for(const statement of queries){statements.push(statement);const result=await transaction.query<Record<string,unknown>>(statement.text,statement.values);results.push({rows:result.rows,rowCount:result.rows.length});}
      return results;
    });
  }};
}
async function posts(count:number,status='published',headline='Homes for everyone',body='Buses and clean energy.',deck='A neighborhood with room to grow.') {
  await db.query(`insert into posts(status,slug,author_name,headline,short_version,final_body,byline,topic_id,writer_id,published_at,is_sample)
    select $1, $1||'-'||n::text, 'Student Writer', $2, $3, $4, 'Student Writer', $5::uuid, $6::uuid, '2026-10-01T12:00:00Z'::timestamptz,true from generate_series(1,$7::integer) n`,[status,headline,deck,body,topic,writer,count]);
}
beforeAll(async()=>{
  db=new PGlite();
  const directory=new URL('../db/migrations/',import.meta.url);
  for(const file of (await readdir(directory)).filter(file=>file.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,directory),'utf8'));
  await db.exec(await readFile(new URL('../db/seed.sql',import.meta.url),'utf8'));
},30000);
beforeEach(async()=>{
  await db.exec(`select public.delete_sample_content(); insert into writers(id,slug,name,is_sample) values('${writer}','student-writer','Student Writer',true)`);
  statements.length=0;
  mocks.neon.mockReset().mockImplementation(transport);
  vi.stubEnv('DATABASE_URL',url);
});
afterEach(()=>vi.unstubAllEnvs());
afterAll(async()=>{await db.close();});

describe('public search and complete listings',()=>{
  it('searches the edited headline, deck and body while RLS excludes drafts and private originals',async()=>{
    await posts(1);
    await posts(1,'new','Classified draft','DraftSecret');
    await db.exec(`insert into submission_private(post_id,author_email,original_body,decline_note,is_sample) select id,'private@illinois.edu','OriginalSecret','NoteSecret',true from posts`);
    for(const query of ['homes','neighborhood','buses','"clean energy"','homes OR buses'])expect(await searchStories(query)).toHaveLength(1);
    for(const query of ['Classified','DraftSecret','OriginalSecret','NoteSecret','private@illinois.edu'])expect(await searchStories(query)).toHaveLength(0);
    const payload=JSON.stringify(await searchStories('homes'));
    for(const privateField of ['original_body','author_email','decline_note','claimed_by','search_document'])expect(payload).not.toContain(privateField);
    expect(statements.some(statement=>statement.text.includes('search_public_posts'))).toBe(true);
  });
  it('uses bound search terms, limits expensive inputs and grants only the search RPC to public callers',async()=>{
    await posts(1);
    const publicDb=createDatabase(url,'public');
    const attack="homes'); DROP TABLE posts; --";
    expect((await publicDb.rpc('search_public_posts',{p_query:attack})).error).toBeNull();
    expect(statements.at(-1)?.values).toContain(attack);
    expect(statements.at(-1)?.text).not.toContain(attack);
    expect((await db.query('select count(*)::integer as n from posts')).rows[0]).toEqual({n:1});
    const executed=statements.length;
    expect((await publicDb.rpc('get_admin_stats')).error?.code).toBe('42501');
    expect(statements).toHaveLength(executed);
    expect(await searchStories('x'.repeat(201))).toEqual([]);
    expect(await searchStories('homes',13,100001)).toEqual([]);
    const permissions=await db.query(`select has_function_privilege('anon','public.search_public_posts(text,integer,integer)','EXECUTE') as anon,has_function_privilege('authenticated','public.search_public_posts(text,integer,integer)','EXECUTE') as reviewer,(select prosecdef from pg_proc where proname='search_public_posts') as definer`);
    expect(permissions.rows[0]).toEqual({anon:true,reviewer:false,definer:false});
  });
  it('paginates search with stable ordering and a database-enforced maximum of 50',async()=>{
    await posts(55);
    const first=await searchStories('homes',13,0), second=await searchStories('homes',13,13);
    expect(first).toHaveLength(13);expect(second).toHaveLength(13);
    expect(new Set([...first,...second].map(story=>story.id)).size).toBe(26);
    expect((await createDatabase(url,'public').rpc<unknown[]>('search_public_posts',{p_query:'homes',p_limit:10000})).data).toHaveLength(50);
  });
  it('includes all 501 published stories in writer, topic, RSS and sitemap listings without exposing drafts',async()=>{
    await posts(501);await posts(1,'new','Private draft');
    const [all,byWriter,byTopic]=await Promise.all([getAllStories(),getWriterStories(writer),getTopicStories(topic)]);
    for(const list of [all,byWriter,byTopic]){expect(list).toHaveLength(501);expect(new Set(list.map(story=>story.id)).size).toBe(501);}
    const response=await rss(),xml=await response.text();
    expect(response.headers.get('content-type')).toContain('application/rss+xml');
    expect(xml.match(/<item>/g)).toHaveLength(501);expect(xml).not.toContain('Private draft');
    const map=await sitemap();
    expect(map.filter(entry=>entry.url.includes('/post/'))).toHaveLength(501);
    expect(map.some(entry=>/\/admin|\/review|\/api\//.test(entry.url))).toBe(false);
  });
});

describe('RSS and calendar safety',()=>{
  it('escapes every RSS value and ignores private properties accidentally attached to a story',async()=>{
    await posts(1,'published','Homes & <trees>','Edited <script>alert(1)</script> & text','A "quoted" deck.');
    const story=(await getAllStories())[0];
    const xml=storyFeed([{...story,original_body:'never-export-original',author_email:'never-export@email.test'} as Story],'https://example.test');
    expect(xml).toContain('Homes &amp; &lt;trees&gt;');expect(xml).toContain('&amp;lt;script&amp;gt;');expect(xml).not.toContain('<script>');
    expect(xml).toContain('[Sample story]');expect(xml).not.toContain('never-export');expect(xml).toContain('<dc:creator>Student Writer</dc:creator>');
  });
  it('escapes ICS delimiters and newlines and folds UTF-8 content to at most 75 octets',()=>{
    expect(calendarText('A\\B,C;D\r\nBEGIN:VEVENT')).toBe('A\\\\B\\,C\\;D\\nBEGIN:VEVENT');
    const original='DESCRIPTION:'+('🌿 café 日本語, '.repeat(25));
    const folded=foldCalendarLine(original);
    for(const line of folded.split('\r\n'))expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g,'')).toBe(original);
  });
  it('uses UTC, an explicit end or a 90-minute fallback, and labels sample calendar entries',()=>{
    const event:Event={id:eventId,slug:'a-gathering',title:'A, B; C',description:'First line\nEND:VEVENT',starts_at:'2026-11-01T01:30:00-05:00',ends_at:null,location:'Room 1, Campus',rsvp_url:null,recap_post_id:null,is_published:true,is_sample:true};
    const ics=eventCalendar(event,'https://example.test',new Date('2026-10-12T12:00:00Z'));
    expect(ics).toContain('DTSTART:20261101T063000Z\r\nDTEND:20261101T080000Z');
    expect(ics).toContain('SUMMARY:Sample event: A\\, B\\; C');expect(ics.match(/\r\nEND:VEVENT/g)).toHaveLength(1);
    expect(ics.replace(/\r\n/g,'')).not.toMatch(/[\r\n]/);expect(ics.endsWith('\r\n')).toBe(true);
    expect(eventCalendar({...event,ends_at:'2026-11-01T09:00:00Z'},'https://example.test')).toContain('DTEND:20261101T090000Z');
  });
  it('serves only public events as calendar downloads and rejects invalid or unpublished IDs',async()=>{
    await db.query(`insert into events(id,slug,title,starts_at,location,is_published,is_sample) values($1,'public-event','Public Event','2026-11-01T12:00:00Z','Campus',true,true),($2,'private-event','Private Event','2026-11-01T12:00:00Z','Secret',false,true)`,[eventId,privateEvent]);
    const request=new Request('https://example.test/events/id/calendar.ics');
    const response=await calendar(request,{params:Promise.resolve({id:eventId})});
    expect(response.status).toBe(200);expect(response.headers.get('content-type')).toContain('text/calendar');expect(response.headers.get('content-disposition')).toContain('.ics');expect(await response.text()).toContain('SUMMARY:Sample event: Public Event');
    for(const id of [privateEvent,'../../etc/passwd'])expect((await calendar(request,{params:Promise.resolve({id})})).status).toBe(404);
  });
});
