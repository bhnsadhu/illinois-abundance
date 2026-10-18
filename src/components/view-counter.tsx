'use client';
import { useEffect } from 'react';

export function ViewCounter({ postId }: { postId: string }) {
  useEffect(() => {
    void fetch('/api/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId }),
      keepalive: true,
    })
      // Drain the response so the browser can finish this background request.
      .then(response => response.arrayBuffer())
      .catch(() => {});
  }, [postId]);
  return null;
}
