import { get } from '@vercel/blob';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{file:string}>}){
 const {file}=await params;
 const missing=()=>new Response('Not found',{status:404,headers:{'Cache-Control':'private, no-store'}});
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/.test(file))return missing();
 try{const result=await get(`media/${file}`,{access:'private'});if(!result||result.statusCode!==200)return missing();
 return new Response(result.stream,{headers:{'Content-Type':'image/webp','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=31536000, immutable'}});
 }catch{return missing();}
}
