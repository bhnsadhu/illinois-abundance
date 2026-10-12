'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
export function DeskNav({name,isAdmin}:{name:string;isAdmin:boolean}) {
  const router=useRouter();const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function logout(){
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/logout',{method:'POST'});
      if(!response.ok)throw new Error();
      router.replace('/login');router.refresh();
    } catch {setError('Could not sign out. Try again.');setBusy(false);}
  }
  return <div className="desk-nav"><div><Link href="/review">Review desk</Link>{isAdmin&&<Link href="/admin">Admin</Link>}</div><div><span>{name}</span><button className="text-button" onClick={logout} disabled={busy}>{busy?'Signing out…':'Sign out'}</button></div>{error&&<p role="alert">{error}</p>}</div>;
}
