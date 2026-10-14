import type { Metadata } from 'next';
import {getSiteContent} from '@/lib/site-content';
import { LoginForm } from '@/components/login-form';
export const metadata: Metadata = { title: 'Reviewer sign in', robots: { index: false, follow: false } };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;const {access}=await getSiteContent();
  return <div className="container verify-page page-section"><h1>{access.reviewerTitle}</h1><p className="form-intro">{access.reviewerIntro}</p>{error && <p className="alert" role="status">Sign in now uses a password. Ask your admin for your credentials.</p>}<LoginForm copy={access}/></div>;
}
