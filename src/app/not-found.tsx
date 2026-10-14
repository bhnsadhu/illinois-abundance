import Link from 'next/link';
export default function NotFound() { return <div className="container narrow page-section"><h1>Page not found.</h1><p>That page may have moved, or the piece is no longer published.</p><Link href="/latest" className="button">Read the latest</Link></div>; }
