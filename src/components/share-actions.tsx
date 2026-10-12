'use client';

import { useState } from 'react';
import { Check, Copy } from '@/components/icons';

export function ShareActions({ slug }: { slug: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(`/post/${slug}`, window.location.origin).href);
      setStatus('copied');
    } catch { setStatus('error'); }
  }
  return <div className="share-actions">
    <div className="share-buttons">
      <button type="button" className="button button-outline button-small" onClick={copyLink}>
        {status === 'copied' ? <Check size={16}/> : <Copy size={16}/>} {status === 'copied' ? 'Link copied' : 'Copy link'}
      </button>
    </div>
    <span className="share-status" role="status">{status === 'error' ? 'Could not copy. You can copy the address from your browser.' : status === 'copied' ? 'Ready to share.' : ''}</span>
  </div>;
}
