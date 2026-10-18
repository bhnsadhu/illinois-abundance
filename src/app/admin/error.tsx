'use client';
export default function AdminError({retry}:{retry:()=>void}){return <div className="empty-state"><h1>Let’s try that again.</h1><p>We couldn’t load the admin tools just now.</p><button className="button" onClick={retry}>Try again</button></div>;}
