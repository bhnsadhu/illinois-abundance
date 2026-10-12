import type {Metadata} from 'next';
import {requireReviewer} from '@/lib/auth';
import {DeskNav} from '@/components/review/desk-nav';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Review desk',robots:{index:false,follow:false}};
export default async function ReviewLayout({children}:{children:React.ReactNode}){const reviewer=await requireReviewer();return <div className="container desk-layout"><DeskNav name={reviewer.name} isAdmin={reviewer.isAdmin}/>{children}</div>;}
