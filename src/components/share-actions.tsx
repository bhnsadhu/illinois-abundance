'use client';

import { useState } from 'react';
import {siteContentDefaults,type SiteContent} from '@/lib/site-content-schema';
import { Check, Copy } from '@/components/icons';

export function ShareActions({ slug,copy=siteContentDefaults.reader }: { slug: string;copy?:SiteContent['reader'] }) {
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
        <span className="copy-feedback">
          <span aria-hidden={status === 'copied'}><Copy size={16}/>{copy.copyLabel}</span>
          <span aria-hidden={status !== 'copied'}><Check size={16}/>{copy.copySuccess}</span>
        </span>
      </button>
    </div>
    <span className="share-status" role="status">{status === 'error' ? copy.copyError : status === 'copied' ? 'Ready to share.' : ''}</span>
  </div>;
}
