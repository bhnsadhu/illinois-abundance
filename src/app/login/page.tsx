import type {Metadata} from 'next';
import {LoginForm} from '@/components/login-form';
export const metadata:Metadata={title:'Reviewer sign in',robots:{index:false,follow:false}};
export default async function LoginPage({searchParams}:{searchParams:Promise<{error?:string}>}){const {error}=await searchParams;return <div className="container verify-page page-section"><span className="eyebrow">THE REVIEW DESK</span><h1>Sign in</h1><p className="form-intro">For reviewers and the admin. We’ll email you a sign-in link.</p>{error&&<p className="alert alert-error" role="alert">That sign in link has expired or already been used. Request a fresh one below.</p>}<LoginForm/></div>;}
