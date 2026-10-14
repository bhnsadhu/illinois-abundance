'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {getAdminLinks} from '@/lib/admin-config';
import {hiddenFeatures,type Visibility} from '@/hidden/features';
export function AdminNav({visibility=hiddenFeatures}:{visibility?:Visibility}){const path=usePathname();return <nav className="admin-nav" aria-label="Site administration">{getAdminLinks(visibility).map(([href,label])=><Link href={href} key={href} aria-current={path===href?'page':undefined}>{label}</Link>)}</nav>;}
