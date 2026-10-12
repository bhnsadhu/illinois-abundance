import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireAdmin} from '@/lib/auth';
import {serviceDatabase} from '@/lib/database/service';
import {adminConfig} from '@/lib/admin-config';
import {AdminManager} from '@/components/admin/manager';
import {SubscriberList} from '@/components/admin/subscribers';
type Props={params:Promise<{resource:string}>;searchParams:Promise<{page?:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{const {resource}=await params;return{title:resource==='subscribers'?'Subscribers':Object.hasOwn(adminConfig,resource)?adminConfig[resource].title:'Admin'};}
export default async function AdminResourcePage({params,searchParams}:Props){
  await requireAdmin();const {resource}=await params;
  if(resource!=='subscribers'&&!Object.hasOwn(adminConfig,resource))notFound();
  const config=adminConfig[resource];const input=(await searchParams).page;
  const page=input&&/^\d+$/.test(input)?Math.max(1,Math.min(10000,Number(input))):1;
  const db=serviceDatabase();const result=await db.from(config?.table||'subscribers').select(config?.columns||'email,confirmed_at',{count:'exact'}).order(config?.order||'email').range((page-1)*50,page*50-1);
  if(result.error)throw new Error('These records are temporarily unavailable.');
  const stories=resource==='events'?await db.from<{id:string;headline:string}>('posts').select('id,headline').eq('status','published').order('published_at',{ascending:false}):null;
  const count=result.count||0;
  return <><div className="desk-heading"><span className="eyebrow">ILLINOIS ABUNDANCE ADMIN</span><h1>{config?.title||'Subscribers'}.</h1><p>{config?.description||'People who asked to hear what’s next. Only confirmed addresses receive the digest.'}</p></div>{resource==='subscribers'?<SubscriberList rows={(result.data||[]) as {email:string;confirmed_at:string|null}[]}/>:<AdminManager resource={resource} rows={result.data||[]} stories={stories?.data||[]}/>}<div className="queue-pagination"><span>{count} total</span>{page>1&&<Link className="text-link" href={`/admin/${resource}?page=${page-1}`}>Previous page</Link>}{page*50<count&&<Link className="text-link" href={`/admin/${resource}?page=${page+1}`}>Next page</Link>}</div></>;
}
