import type {Metadata} from 'next';
import {requireAdmin} from '@/lib/auth';
import {DeskNav} from '@/components/review/desk-nav';
import {AdminNav} from '@/components/admin/nav';
import {getSiteContent} from '@/lib/site-content';
import {contentVisibility} from '@/lib/site-content-schema';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Admin',robots:{index:false,follow:false}};
export default async function AdminLayout({children}:{children:React.ReactNode}) {
  const admin=await requireAdmin();const content=await getSiteContent();
  return <div className="container desk-layout"><DeskNav name={admin.name} isAdmin/><AdminNav visibility={contentVisibility(content)}/>{children}</div>;
}
