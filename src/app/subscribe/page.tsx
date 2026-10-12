import type {Metadata} from 'next';
import {SubscriptionForm} from '@/components/subscription-form';
export const metadata:Metadata={title:'Subscribe',description:'Good ideas and the next teach in, in your inbox.',alternates:{canonical:'/subscribe'}};
export default function SubscribePage(){return <div className="container verify-page page-section"><span className="eyebrow">A LITTLE MORE IN YOUR INBOX</span><h1>Stay curious.</h1><p className="form-intro">New writing. Local conversations. A reason to show up.</p><SubscriptionForm/></div>;}
