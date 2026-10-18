'use client';
import { readApiResponse } from '@/lib/client-response';
import { useEffect, useRef, useState } from 'react';
export function PasswordForm({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) feedback.current?.focus(); }, [error]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSaved(false);
    const form = event.currentTarget;
    const data = new FormData(form);
    if (data.get('newPassword') !== data.get('confirmPassword')) { setError('The new passwords do not match.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/account/password', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: data.get('currentPassword'), newPassword: data.get('newPassword'), confirmPassword: data.get('confirmPassword') }) });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error || 'Please try again.');
      form.reset(); setSaved(true);
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return <form className="form-card password-form" onSubmit={submit}>
    <input type="hidden" name="username" autoComplete="username" value={email}/>
    <label>Current password<input name="currentPassword" type="password" autoComplete="current-password" maxLength={128} required/></label>
    <label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} aria-describedby="password-hint" required/><span id="password-hint" className="field-hint">Use at least 12 characters.</span></label>
    <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
    {error && <p ref={feedback} tabIndex={-1} className="alert alert-error" role="alert">{error}</p>}
    {saved && <p className="alert" role="status">Your password has changed. Your other sessions have been signed out.</p>}
    <button className="button" disabled={busy} aria-busy={busy}>{busy ? 'Changing password…' : 'Change password'}</button>
  </form>;
}
