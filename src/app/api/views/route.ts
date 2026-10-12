import {z} from 'zod';
import {apiFailure,guardRateLimit,HttpError,privateJson,readJson,requireOrigin} from '@/lib/api';
import {privateHash,requestIp,secret} from '@/lib/security';
import {serviceDatabase} from '@/lib/database/service';
const schema=z.object({postId:z.uuid()}).strict();
export async function POST(request:Request){
  try{
    requireOrigin(request);
    const {postId}=schema.parse(await readJson(request,1024));
    const ip=requestIp(request);
    await guardRateLimit('article-views',ip,180,600);
    const day=new Date().toISOString().slice(0,10);
    const hash=privateHash(`${day}:${ip}:${(request.headers.get('user-agent')||'').slice(0,500)}`,secret('VIEW_SALT'));
    const {error}=await serviceDatabase().rpc('record_post_view',{p_post_id:postId,p_visitor_hash:hash});
    if(error)throw new HttpError('We could not record this view.',503);
    return privateJson({ok:true});
  }catch(error){return apiFailure(error);}
}
