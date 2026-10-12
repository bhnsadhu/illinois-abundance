import 'server-only';
import { requireReviewer } from './auth';
import { serviceDatabase } from './database/service';
import type { PostStatus, Source } from './types';

export type ReviewPost = { id:string;status:PostStatus;slug:string|null;author_name:string;final_body:string;headline:string;short_version:string;sources:Source[];topic_id:string|null;byline:string;writer_id:string|null;cover_url:string|null;cover_alt:string|null;published_at:string|null;updated_at:string;created_at:string;version:number;is_sample:boolean };
export type PrivateSubmission = {post_id:string;author_email:string;original_body:string;claimed_by:string|null;claimed_at:string|null;decline_note:string|null};
type QueuePost = Pick<ReviewPost,'id'|'status'|'author_name'|'headline'|'final_body'|'created_at'|'version'>;

export async function getReviewPost(id:string) {
  await requireReviewer();
  const db=serviceDatabase();
  const [post,privateData]=await Promise.all([
    db.from('posts').select('id,status,slug,author_name,final_body,headline,short_version,sources,topic_id,byline,writer_id,cover_url,cover_alt,published_at,updated_at,created_at,version,is_sample').eq('id',id).maybeSingle(),
    db.from('submission_private').select('post_id,author_email,original_body,claimed_by,claimed_at,decline_note').eq('post_id',id).maybeSingle(),
  ]);
  if(post.error || privateData.error) throw new Error('The review desk is temporarily unavailable.');
  return post.data?{post:post.data as ReviewPost,submission:privateData.data as PrivateSubmission|null}:null;
}

export async function getQueue(status:PostStatus,page=1) {
  await requireReviewer();
  const db=serviceDatabase();
  const posts=await db.from('posts').select('id,status,author_name,headline,final_body,created_at,version',{count:'exact'}).eq('status',status).order('created_at',{ascending:false}).range((page-1)*30,page*30-1);
  if(posts.error) throw new Error('The review desk is temporarily unavailable.');
  const items=(posts.data||[]) as QueuePost[];
  const claims=items.length?await db.from('submission_private').select('post_id,claimed_by').in('post_id',items.map(p=>p.id)):null;
  if(claims?.error) throw new Error('The review desk is temporarily unavailable.');
  const claimRows=(claims?.data||[]) as Pick<PrivateSubmission,'post_id'|'claimed_by'>[];
  const reviewerIds=[...new Set(claimRows.flatMap(c=>c.claimed_by?[c.claimed_by]:[]))];
  const reviewers=reviewerIds.length?await db.from('reviewers').select('id,name').in('id',reviewerIds):null;
  const reviewerRows=(reviewers?.data||[]) as {id:string;name:string}[];
  const rows=items.map(post=>{
    const claim=claimRows.find(c=>c.post_id===post.id);
    return {...post,claimed_by:claim?.claimed_by||null,claimed_name:reviewerRows.find(r=>r.id===claim?.claimed_by)?.name||null};
  });
  return {rows,count:posts.count||0};
}
