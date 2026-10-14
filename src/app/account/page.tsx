import type { Metadata } from 'next';
import { requireReviewer } from '@/lib/auth';
import { DeskNav } from '@/components/review/desk-nav';
import { PasswordForm } from '@/components/password-form';
import '../desk.css';
export const metadata: Metadata = { title: 'Change password', robots: { index: false, follow: false } };
export default async function AccountPage() {
  const reviewer = await requireReviewer();
  return <div className="container desk-layout"><DeskNav name={reviewer.name} isAdmin={reviewer.isAdmin}/><div className="desk-heading"><h1>Change password</h1><p>Signed in as {reviewer.email}</p></div><PasswordForm email={reviewer.email}/></div>;
}
