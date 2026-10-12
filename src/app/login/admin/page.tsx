import type { Metadata } from 'next';
import { LoginForm } from '@/components/login-form';
export const metadata: Metadata = { title: 'Admin sign in', robots: { index: false, follow: false } };
export default function AdminLoginPage() {
  return <div className="container verify-page page-section"><span className="eyebrow">ADMINISTRATION</span><h1>Admin sign in</h1><p className="form-intro">Manage your publication and the people who help it grow.</p><LoginForm role="admin"/></div>;
}
