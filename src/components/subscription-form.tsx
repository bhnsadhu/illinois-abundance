'use client';
import { readApiResponse } from '@/lib/client-response';
import {useEffect,useRef,useState} from 'react';
import {siteContentDefaults,type SiteContent} from '@/lib/site-content-schema';
import {ArrowRight} from './icons';
export function SubscriptionForm({compact=false,copy=siteContentDefaults.newsletter}:{compact?:boolean;copy?:SiteContent['newsletter']}){
  const [busy,setBusy]=useState(false);const [sent,setSent]=useState(false);const [error,setError]=useState('');const feedback=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(sent||error)feedback.current?.focus();},[sent,error]);
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');const data=new FormData(event.currentTarget);try{const response=await fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:data.get('email'),website:data.get('website')})});const result=await readApiResponse(response);if(!response.ok)throw new Error(result.error||'Please try again in a moment.');setSent(true);}catch(error){setError(error instanceof Error?error.message:'Please try again in a moment.');}finally{setBusy(false);}}
  return <div className={compact?'subscribe-form-compact':'form-card'}>{sent?<div ref={feedback} tabIndex={-1} role="status"><h2 className="subscribe-success-title">{copy.successTitle}</h2><p>{copy.successBody}</p><p className="field-hint">{copy.successHint}</p></div>:<form onSubmit={submit}><div className="subscribe-fields"><label>{copy.emailLabel}<input name="email" type="email" autoComplete="email" autoCapitalize="none" required maxLength={254} placeholder={copy.emailPlaceholder}/></label><button className="button" disabled={busy} aria-busy={busy}>{busy?'Sending…':copy.buttonLabel}<ArrowRight size={17}/></button></div><div className="honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>{error&&<div ref={feedback} tabIndex={-1}><p className="alert alert-error" role="alert">{error}</p></div>}<p className="consent-copy">{copy.consent}</p></form>}</div>;
}
