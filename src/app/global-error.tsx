'use client';

// This fallback must work even when the root layout's content service fails.
export default function GlobalError({ retry }: { retry: () => void }) {
  return <html lang="en"><body style={{ margin: 0, background: '#fffbe4', color: '#25302a', fontFamily: 'system-ui, sans-serif' }}>
    <main style={{ maxWidth: 560, margin: '15vh auto', padding: 24, lineHeight: 1.6 }}>
      <h1 style={{ fontSize: '2rem', lineHeight: 1.2 }}>We’ll be right back.</h1>
      <p>Illinois Abundance couldn’t load just now. Please try again in a moment.</p>
      <button onClick={retry} style={{ font: 'inherit', background: '#204c49', color: '#fff', border: 0, borderRadius: 24, padding: '12px 24px', minHeight: 44, cursor: 'pointer' }}>Try again</button>
    </main>
  </body></html>;
}
