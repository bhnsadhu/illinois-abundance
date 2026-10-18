'use client';
import { readApiResponse } from '@/lib/client-response';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {siteContentDefaults,type SiteContent} from '@/lib/site-content-schema';
import { ArrowRight } from './icons';

export function LoginForm({ role = 'reviewer',copy=siteContentDefaults.access }: { role?: 'admin' | 'reviewer';copy?:SiteContent['access'] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.get('email'), password: data.get('password'), role, website: data.get('website') }) });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error || 'Please try again in a moment.');
      router.replace(result.redirect === '/admin' ? '/admin' : '/review');
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); setBusy(false); }
  }
  return <form className="form-card login-form" onSubmit={submit}>
    <label><span className="sr-only">{copy.emailLabel}</span><input name="email" type="email" autoComplete="username" autoCapitalize="none" maxLength={254} placeholder={copy.emailLabel} required/></label>
    <label><span className="sr-only">{copy.passwordLabel}</span><input name="password" type="password" autoComplete="current-password" maxLength={128} placeholder={copy.passwordLabel} required/></label>
    <div className="honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
    {error && <p className="alert alert-error" role="alert">{error}</p>}
    <button className="button full-width" disabled={busy} aria-busy={busy}>{busy ? 'Signing in…' : role === 'admin' ? copy.adminButton : copy.reviewerButton}<ArrowRight size={17}/></button>
    {role === 'reviewer' && <p className="consent-copy login-note">{copy.resetHint}</p>}
    <p className="login-note"><Link className="text-link" href={role === 'admin' ? '/login' : '/login/admin'}>{role === 'admin' ? copy.reviewerTitle : copy.adminTitle}</Link></p>
  </form>;
}
