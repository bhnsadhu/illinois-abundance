/** The same leaf shapes as the home garden, used as a quiet brand signature. */
export function Sprout({ className = '' }: { className?: string }) {
  return <svg className={`sprout ${className}`} viewBox="0 0 80 88" fill="none" aria-hidden="true" focusable="false">
    <path d="M12 78c17-3 39-3 56 0" stroke="var(--line)" strokeWidth="2" strokeLinecap="round"/>
    <path d="M40 72V39" stroke="var(--deep-teal)" strokeWidth="3" strokeLinecap="round"/>
    <path d="M40 55C24 56 15 46 17 34c15-1 24 7 23 21Z" fill="var(--teal)" stroke="var(--deep-teal)" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M40 44c-1-18 9-28 25-28 1 17-8 29-25 28Z" fill="var(--soft-teal)" stroke="var(--deep-teal)" strokeWidth="2" strokeLinejoin="round"/>
    <path d="m25 42 15 13m0-11 16-18" stroke="var(--deep-teal)" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="m36 72-3 5m11-5 4 5" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}
