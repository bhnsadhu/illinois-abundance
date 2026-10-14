import type {Metadata} from 'next';
import Link from 'next/link';
import {getSubscriptionResult} from '@/lib/subscriptions';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Unsubscribe',robots:{index:false,follow:false}};
export default async function Unsubscribe({searchParams}:{searchParams:Promise<{token?:string}>}){const {token}=await searchParams;const result=await getSubscriptionResult(token,'unsubscribe');return <div className="container verify-page page-section"><h1>{result==='unsubscribed'?'Unsubscribed.':result==='unavailable'?'Please try again.':'Link unavailable.'}</h1><p className="form-intro">{result==='unsubscribed'?'You won’t receive another digest.':result==='unavailable'?'We couldn’t update your subscription just now. Please try the link again.':'The link is no longer active. You may already have unsubscribed.'}</p>{result==='unavailable'?<form><input type="hidden" name="token" value={token||''}/><button className="button">Try again</button></form>:<Link href="/latest" className="button button-outline">Read the stories</Link>}</div>;}
