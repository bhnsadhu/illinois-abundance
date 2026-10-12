'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {adminLinks} from '@/lib/admin-config';
export function AdminNav(){const path=usePathname();return <nav className="admin-nav" aria-label="Site administration">{adminLinks.map(([href,label])=><Link href={href} key={href} aria-current={path===href?'page':undefined}>{label}</Link>)}</nav>;}
