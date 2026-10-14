import type {Metadata} from 'next';
import {VerificationForm} from '@/components/verification-form';
import {getSiteContent} from '@/lib/site-content';
export const metadata:Metadata={title:'Confirm your email',robots:{index:false,follow:false}};
export default async function VerifyPage(){const {write}=await getSiteContent();return <div className="container verify-page page-section"><VerificationForm copy={write}/></div>;}
