'use client';
export default function AdminError({reset}:{reset:()=>void}){return <div className="empty-state"><h1>Let’s try that again.</h1><p>We couldn’t load the admin tools just now.</p><button className="button" onClick={reset}>Try again</button></div>;}
