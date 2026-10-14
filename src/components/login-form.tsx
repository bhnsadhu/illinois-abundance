'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from './icons';

export function LoginForm({ role = 'reviewer' }: { role?: 'admin' | 'reviewer' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.get('email'), password: data.get('password'), role, website: data.get('website') }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Please try again in a moment.');
      router.replace(result.redirect === '/admin' ? '/admin' : '/review');
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); setBusy(false); }
  }
  return <form className="form-card login-form" onSubmit={submit}>
    <label>Email address<input name="email" type="email" autoComplete="username" autoCapitalize="none" maxLength={254} placeholder={role === 'admin' ? 'Your admin email' : 'Your reviewer email'} required/></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" maxLength={128} required/></label>
    <div className="honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
    {error && <p className="alert alert-error" role="alert">{error}</p>}
    <button className="button full-width" disabled={busy}>{busy ? 'Signing in…' : role === 'admin' ? 'Sign in as admin' : 'Sign in as reviewer'}<ArrowRight size={17}/></button>
    {role === 'reviewer' && <p className="consent-copy login-note">Need a password reset? Ask your admin.</p>}
    <p className="login-note"><Link className="text-link" href={role === 'admin' ? '/login' : '/login/admin'}>{role === 'admin' ? 'Reviewer sign in' : 'Admin sign in'}</Link></p>
  </form>;
}
