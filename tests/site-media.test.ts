import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import sharp from 'sharp';
import {POST} from '@/app/api/admin/media/route';
import {GET} from '@/app/media/[file]/route';
import {site} from '@/lib/config';
const mocks=vi.hoisted(()=>({reviewer:vi.fn(),put:vi.fn(),get:vi.fn()}));
vi.mock('@/lib/auth',()=>({getReviewer:mocks.reviewer}));
vi.mock('@vercel/blob',()=>({put:mocks.put,get:mocks.get}));
vi.mock('@/lib/database/service',()=>({serviceDatabase:()=>({rpc:async()=>({data:true,error:null})})}));
function request(bytes:Uint8Array,type='image/png',origin=site.url){const form=new FormData();form.set('file',new File([new Uint8Array(bytes)],'image.png',{type}));form.set('alt','An accessible image description');return new Request(new URL('/api/admin/media',site.url),{method:'POST',headers:{origin},body:form});}
beforeEach(()=>{vi.stubEnv('ADMIN_EMAIL','admin@example.test');vi.stubEnv('CODE_PEPPER','site-media-test-pepper-longer-than-32-characters');mocks.reviewer.mockResolvedValue({id:'admin-id',email:'admin@example.test',isAdmin:true});mocks.put.mockReset().mockResolvedValue({});mocks.get.mockReset();});
afterEach(()=>vi.unstubAllEnvs());
describe('site media',()=>{
 it('only accepts uploads from a configured admin and the same origin',async()=>{mocks.reviewer.mockResolvedValue(null);expect((await POST(request(new Uint8Array()))).status).toBe(401);for(const isAdmin of [false,true]){mocks.reviewer.mockResolvedValue({id:'reviewer-id',email:'reviewer@example.test',isAdmin});expect((await POST(request(new Uint8Array()))).status).toBe(403);}expect((await POST(request(new Uint8Array(),'image/png','https://evil.example'))).status).toBe(403);expect(mocks.put).not.toHaveBeenCalled();});
 it('decodes, resizes and strips metadata before storing a public site image in private storage',async()=>{const bytes=await sharp({create:{width:1800,height:1300,channels:3,background:'#244e49'}}).png().withMetadata().toBuffer();const response=await POST(request(bytes));expect(response.status).toBe(200);expect((await response.json()).url).toMatch(/^\/media\/[0-9a-f-]{36}\.webp$/);const [path,output,options]=mocks.put.mock.calls[0];expect(path).toMatch(/^media\//);expect(options.access).toBe('private');const metadata=await sharp(output).metadata();expect(metadata.format).toBe('webp');expect(metadata.width).toBeLessThanOrEqual(1600);expect(metadata.exif).toBeUndefined();});
 it('rejects disguised SVG and arbitrary media paths',async()=>{expect((await POST(request(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')))).status).toBe(400);for(const file of ['../secret','arbitrary.webp','00000000-0000-4000-8000-000000000001.svg'])expect((await GET(new Request(site.url),{params:Promise.resolve({file})})).status).toBe(404);expect(mocks.get).not.toHaveBeenCalled();});
 it('serves only the requested generated image as WebP',async()=>{const file='00000000-0000-4000-8000-000000000001.webp';mocks.get.mockResolvedValue({statusCode:200,stream:new Blob(['image']).stream()});const response=await GET(new Request(site.url),{params:Promise.resolve({file})});expect(response.status).toBe(200);expect(response.headers.get('content-type')).toBe('image/webp');expect(response.headers.get('x-content-type-options')).toBe('nosniff');expect(mocks.get).toHaveBeenCalledWith('media/'+file,{access:'private'});});
});
