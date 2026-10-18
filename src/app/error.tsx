'use client';

import Link from 'next/link';

export default function PageError({ retry }: { retry: () => void }) {
  return <div className="container extras-page">
    <section className="empty-state" aria-labelledby="error-heading">
      <h1 id="error-heading">Let’s try that again.</h1>
      <p>We couldn’t load this page just now. Please try again in a moment.</p>
      <button className="button" onClick={retry}>Try again</button>
      <p><Link className="text-link" href="/">Back to home</Link></p>
    </section>
  </div>;
}
