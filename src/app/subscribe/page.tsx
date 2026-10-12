import type {Metadata} from 'next';
import {SubscriptionForm} from '@/components/subscription-form';
export const metadata:Metadata={title:'Subscribe',description:'Get new articles and upcoming teach ins by email.',alternates:{canonical:'/subscribe'}};
export default function SubscribePage(){return <div className="container verify-page page-section"><span className="eyebrow">ILLINOIS ABUNDANCE BY EMAIL</span><h1>Subscribe</h1><p className="form-intro">Get new articles and upcoming teach ins by email. Unsubscribe whenever you like.</p><SubscriptionForm/></div>;}
