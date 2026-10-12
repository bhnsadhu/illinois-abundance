import Link from 'next/link';
export default function NotFound() { return <div className="container narrow page-section"><span className="eyebrow">404 · A WRONG TURN</span><h1>Nothing on this block.</h1><p>That page may have moved, or the piece is no longer published.</p><Link href="/" className="button">Read the latest</Link></div>; }
