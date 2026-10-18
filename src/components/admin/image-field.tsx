'use client';
import Image from 'next/image';
import {useRef,useState} from 'react';
export function ImageField({label,value,alt='',onChange,onBusy,disabled=false}:{label:string;value:string;alt?:string;onChange:(url:string,alt?:string)=>void;onBusy?:(busy:boolean)=>void;disabled?:boolean}){
 const input=useRef<HTMLInputElement>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function upload(file:File|undefined){if(!file)return;setBusy(true);onBusy?.(true);setError('');try{
  const data=new FormData();data.set('file',file);data.set('alt',alt.trim()||label);
  const response=await fetch('/api/admin/media',{method:'POST',body:data});const result=await response.json();
  if(!response.ok)throw new Error(result.error||'Could not upload the image.');onChange(result.url,result.alt);
 }catch(error){setError(error instanceof Error?error.message:'Could not upload the image.');}finally{setBusy(false);onBusy?.(false);if(input.current)input.current.value='';}}
 return <div className="site-image-field"><span className="site-field-label">{label}</span>{value&&<Image src={value} width={400} height={240} alt={alt||label} unoptimized className="site-image-preview"/>}<div className="site-image-actions"><button type="button" className="button button-small button-outline" disabled={busy||disabled} aria-busy={busy} onClick={()=>input.current?.click()}>{busy?'Uploading…':value?'Replace image':'Upload image'}</button>{value&&<button type="button" className="text-button" disabled={busy||disabled} onClick={()=>onChange('')}>Remove</button>}</div><input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden disabled={busy||disabled} aria-label={`Upload ${label.toLowerCase()}`} onChange={event=>void upload(event.target.files?.[0])}/><p className="field-hint">JPG, PNG, WebP, or AVIF. Up to 4 MB.</p>{error&&<p className="alert alert-error" role="alert">{error}</p>}</div>;
}

export function AdminImageField({name,altName,label,value,alt,onBusy}:{name:string;altName:string;label:string;value:string;alt:string;onBusy:(busy:boolean)=>void}){
 const [url,setUrl]=useState(value);const [description,setDescription]=useState(alt);const [busy,setBusy]=useState(false);
 return <div><ImageField label={label} value={url} alt={description} onBusy={value=>{setBusy(value);onBusy(value);}} onChange={(next,nextAlt)=>{setUrl(next);if(nextAlt&&!description)setDescription(nextAlt);}}/><input type="hidden" name={name} value={url}/><label>Image description<input name={altName} value={description} disabled={busy} maxLength={300} required={Boolean(url)} onChange={e=>setDescription(e.target.value)}/></label></div>;
}
