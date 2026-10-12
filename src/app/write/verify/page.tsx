import type {Metadata} from 'next';
import {VerificationForm} from '@/components/verification-form';
export const metadata:Metadata={title:'Confirm your email',robots:{index:false,follow:false}};
export default function VerifyPage(){return <div className="container verify-page page-section"><VerificationForm/></div>;}
