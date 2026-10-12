import type {Metadata} from 'next';
import {requireAdmin} from '@/lib/auth';
import {DeskNav} from '@/components/review/desk-nav';
import {AdminNav} from '@/components/admin/nav';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Admin',robots:{index:false,follow:false}};
export default async function AdminLayout({children}:{children:React.ReactNode}) {
  const admin=await requireAdmin();
  return <div className="container desk-layout"><DeskNav name={admin.name} isAdmin/><AdminNav/>{children}</div>;
}
