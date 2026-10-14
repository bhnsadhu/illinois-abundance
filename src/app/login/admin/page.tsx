import type { Metadata } from 'next';
import {getSiteContent} from '@/lib/site-content';
import { LoginForm } from '@/components/login-form';
export const metadata: Metadata = { title: 'Admin sign in', robots: { index: false, follow: false } };
export default async function AdminLoginPage() {
  const {access}=await getSiteContent();
  return <div className="container verify-page page-section"><h1>{access.adminTitle}</h1><LoginForm role="admin" copy={access}/></div>;
}
