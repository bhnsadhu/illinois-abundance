import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {afterAll,afterEach,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {POST} from '@/app/api/admin/site-content/route';
import {createDatabase} from '@/lib/database/client';
import {contentLinkSchema,imagePathSchema,parseSiteSection,upgradeLegacySiteSection, siteContentDefaults,siteSections} from '@/lib/site-content-schema';
import {site} from '@/lib/config';
const mocks=vi.hoisted(()=>({reviewer:vi.fn(),tag:vi.fn(),path:vi.fn()}));
vi.mock('@/lib/auth',()=>({getReviewer:mocks.reviewer}));
vi.mock('next/cache',()=>({revalidateTag:mocks.tag,revalidatePath:mocks.path}));
let db:PGlite;
vi.mock('@neondatabase/serverless',()=>({neon:()=>({
 async query(text:string,values:unknown[]=[]){const result=await db.query(text,values);return {rows:result.rows,rowCount:result.affectedRows??result.rows.length};},
 async transaction(work:(tx:{query:(text:string,values:unknown[])=>{text:string;values:unknown[]}})=>{text:string;values:unknown[]}[]){return db.transaction(async tx=>{const results=[];for(const s of work({query:(text,values)=>({text,values})})){const result=await tx.query(s.text,s.values);results.push({rows:result.rows,rowCount:result.affectedRows??result.rows.length});}return results;});},
})}));
const email='owner@example.test',id='71000000-0000-4000-8000-000000000001';
function call(input:unknown,origin=site.url){return POST(new Request(new URL('/api/admin/site-content',site.url),{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(input)}));}
const body=(version=0,firstLine='A new headline')=>({section:'home',version,values:{...siteContentDefaults.home,firstLine}});
beforeAll(async()=>{db=new PGlite();for(const name of (await readdir('db/migrations')).filter(name=>name.endsWith('.sql')).sort())await db.exec(await readFile('db/migrations/'+name,'utf8'));},30000);
beforeEach(async()=>{await db.exec('delete from site_content;delete from rate_limits');vi.stubEnv('DATABASE_URL','postgresql://test:test@localhost/test');vi.stubEnv('ADMIN_EMAIL',email);vi.stubEnv('SECOND_ADMIN_EMAIL','second@example.test');vi.stubEnv('CODE_PEPPER','test-site-content-pepper-over-32-characters');mocks.reviewer.mockResolvedValue({id,email,isAdmin:true});mocks.tag.mockClear();mocks.path.mockClear();});
afterEach(()=>vi.unstubAllEnvs());afterAll(async()=>{await db.close();});
describe('site content editing',()=>{
 it('validates every default section and rejects unknown fields, unsafe links, oversized lists and secret settings',()=>{
  for(const section of siteSections)expect(parseSiteSection(section,siteContentDefaults[section])).toEqual(siteContentDefaults[section]);
  for(const link of ['javascript:alert(1)','//evil.example','/\\evil.example','https://user:password@example.test','data:text/html,evil','https://example.test/\n'])expect(contentLinkSchema.safeParse(link).success).toBe(false);
  for(const link of ['/write','/about#writing','https://example.test/page'])expect(contentLinkSchema.safeParse(link).success).toBe(true);
  expect(()=>parseSiteSection('branding',{...siteContentDefaults.branding,ADMIN_EMAIL:'new@example.test'})).toThrow();
  expect(()=>parseSiteSection('navigation',{...siteContentDefaults.navigation,links:Array(13).fill({label:'Item',href:'/about'})})).toThrow();
  for(const path of ['https://example.test/image.png','/media/../../secret.webp','/covers/private.webp','/brand/../../secret.png'])expect(imagePathSchema.safeParse(path).success).toBe(false);
 });
 it('updates previous homepage defaults without replacing custom copy or removing curated links',()=>{
  const legacy={firstLine:'Our community',secondLine:'With room for more.',secondaryLabel:'Come to a campus event',secondaryHref:'/events'};
  expect(upgradeLegacySiteSection('home',legacy)).toEqual({...legacy,secondLine:'Cultivating our Garden',secondaryLabel:'Publish with us',secondaryHref:'/write'});
  expect(upgradeLegacySiteSection('home',{secondaryLabel:'Write the stories',secondaryHref:'/write'})).toEqual({secondaryLabel:'Publish with us',secondaryHref:'/write'});
  expect(upgradeLegacySiteSection('navigation',{writeLabel:'Write for us',writeHref:'/write'})).toEqual({writeLabel:'Publish with us',writeHref:'/write'});
  const custom={secondLine:'A custom headline',secondaryLabel:'Pitch a story',secondaryHref:'/about',newsItems:[]};
  expect(upgradeLegacySiteSection('home',custom)).toEqual(custom);
  expect(parseSiteSection('home',{...siteContentDefaults.home,newsItems:[]})).toMatchObject({newsItems:[]});
  expect(()=>parseSiteSection('home',{...siteContentDefaults.home,newsItems:[{...siteContentDefaults.home.newsItems[0],href:'javascript:alert(1)'}]})).toThrow();
 });
 it('carries the garden theme into saved defaults while preserving editorial changes',()=>{
  expect(upgradeLegacySiteSection('write',{title:'Write for Illinois Abundance.',successBody:'One of our reviewers will contact you soon.'})).toMatchObject({title:siteContentDefaults.write.title,successBody:siteContentDefaults.write.successBody});
  const oldAbout={sections:[structuredClone(siteContentDefaults.about.sections[0])],writeTitle:'Write for us'};
  const upgraded=upgradeLegacySiteSection('about',oldAbout);
  expect(upgraded).toEqual({sections:siteContentDefaults.about.sections,writeTitle:siteContentDefaults.about.writeTitle});
  expect(upgradeLegacySiteSection('about',upgraded)).toEqual(upgraded);
  expect(oldAbout.sections).toHaveLength(1);
  const custom={sections:[{title:oldAbout.sections[0].title,body:'Our editor’s explanation.'}],writeTitle:'Send your pitch'};
  expect(upgradeLegacySiteSection('about',custom)).toEqual(custom);
  expect(upgradeLegacySiteSection('about',{sections:[]})).toEqual({sections:[]});
  expect(upgradeLegacySiteSection('write',{title:'A custom invitation',successBody:'We will reply by Friday.'})).toEqual({title:'A custom invitation',successBody:'We will reply by Friday.'});
 });
 it('requires an authenticated configured admin and same-origin request',async()=>{
  mocks.reviewer.mockResolvedValue(null);expect((await call(body())).status).toBe(401);
  mocks.reviewer.mockResolvedValue({id,email:'reviewer@example.test',isAdmin:false});expect((await call(body())).status).toBe(403);
  mocks.reviewer.mockResolvedValue({id,email:'fake@example.test',isAdmin:true});expect((await call(body())).status).toBe(403);
  mocks.reviewer.mockResolvedValue({id,email,isAdmin:true});expect((await call(body(),'https://evil.example')).status).toBe(403);
  expect((await db.query('select * from site_content')).rows).toEqual([]);
 });
 it('saves durable public content, invalidates all public layouts, and allows both configured admins',async()=>{
  const first=await call(body());expect(first.status).toBe(200);expect(await first.json()).toEqual({ok:true,version:1});
  expect(mocks.tag).toHaveBeenCalledWith('site-content',{expire:0});expect(mocks.path).toHaveBeenCalledWith('/','layout');
  const result=await createDatabase('postgresql://test:test@localhost/test','public').from('public_site_content').select('section,content,version');expect(result.error).toBeNull();expect(result.data?.[0]).toMatchObject({section:'home',version:1,content:{firstLine:'A new headline'}});
  mocks.reviewer.mockResolvedValue({id,email:'second@example.test',isAdmin:true});expect((await call(body(1,'Edited by second admin'))).status).toBe(200);
 });
 it('rejects both initial and later stale saves without overwriting the other admin',async()=>{
  expect((await call(body())).status).toBe(200);expect((await call(body(0,'Stale initial'))).status).toBe(409);
  expect((await call(body(1,'Latest saved'))).status).toBe(200);expect((await call(body(1,'Stale tab'))).status).toBe(409);
  expect((await db.query('select content,version from site_content')).rows[0]).toMatchObject({version:2,content:{firstLine:'Latest saved'}});
 });
 it('rejects malformed payloads before saving',async()=>{
  for(const input of [{...body(),section:'credentials'},{...body(),version:-1},{...body(),values:{firstLine:'Partial'}},{...body(),values:{...body().values,primaryHref:'javascript:alert(1)'}},{...body(),isAdmin:true}])expect((await call(input)).status).toBe(400);
  expect((await db.query('select * from site_content')).rows).toEqual([]);
 });
 it('enforces SQL read-only access for anonymous users and reviewers',async()=>{
  for(const role of ['anon','authenticated']){
   expect((await db.query(`select has_table_privilege($1,'public.site_content','INSERT') as insert,has_table_privilege($1,'public.site_content','UPDATE') as update,has_function_privilege($1,'public.save_site_content(text,jsonb,integer)','EXECUTE') as execute`,[role])).rows[0]).toEqual({insert:false,update:false,execute:false});
  }
  const publicDb=createDatabase('postgresql://test:test@localhost/test','public');expect((await publicDb.from('public_site_content').update({content:{}})).error?.code).toBe('42501');expect((await publicDb.rpc('save_site_content',{p_section:'home',p_values:{},p_expected_version:0})).error?.code).toBe('42501');
 });
});
