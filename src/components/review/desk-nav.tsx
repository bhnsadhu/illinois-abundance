'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useState} from 'react';
export function DeskNav({name,isAdmin}:{name:string;isAdmin:boolean}) {
  const router=useRouter();const path=usePathname();const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function logout(){
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/logout',{method:'POST'});
      if(!response.ok)throw new Error();
      router.replace(isAdmin?'/login/admin':'/login');router.refresh();
    } catch {setError('Could not sign out. Try again.');setBusy(false);}
  }
  return <nav className="desk-nav" aria-label="Workspace"><div><Link href="/review" aria-current={path.startsWith('/review')?'location':undefined}>Review desk</Link>{isAdmin&&<Link href="/admin" aria-current={path.startsWith('/admin')?'location':undefined}>Admin</Link>}<Link href="/account" aria-current={path==='/account'?'page':undefined}>Change password</Link></div><div><span>{name}</span><button className="text-button" onClick={logout} disabled={busy} aria-busy={busy}>{busy?'Signing out…':'Sign out'}</button></div>{error&&<p role="alert">{error}</p>}</nav>;
}
