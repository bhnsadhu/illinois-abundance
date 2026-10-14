import type { Metadata } from 'next';
import { LoginForm } from '@/components/login-form';
export const metadata: Metadata = { title: 'Reviewer sign in', robots: { index: false, follow: false } };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <div className="container verify-page page-section"><h1>Reviewer sign in</h1><p className="form-intro">Sign in with the credentials your admin shared.</p>{error && <p className="alert" role="status">Sign in now uses a password. Ask your admin for your credentials.</p>}<LoginForm/></div>;
}
