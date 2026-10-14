import type {Metadata} from 'next';
import {SubscriptionForm} from '@/components/subscription-form';
import {getSiteContent} from '@/lib/site-content';
export const metadata:Metadata={title:'Subscribe',description:'Get new articles and upcoming teach ins by email.',alternates:{canonical:'/subscribe'}};
export default async function SubscribePage(){const {newsletter}=await getSiteContent();return <div className="container verify-page page-section"><h1>{newsletter.title}</h1><p className="form-intro">{newsletter.intro}</p><SubscriptionForm copy={newsletter}/></div>;}
