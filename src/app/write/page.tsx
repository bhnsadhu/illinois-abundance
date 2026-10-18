import type {Metadata} from 'next';
import {SubmissionForm} from '@/components/submission-form';
import {Sprout} from '@/components/sprout';
import {getSiteContent} from '@/lib/site-content';
export async function generateMetadata():Promise<Metadata>{const {write}=await getSiteContent();return {title:write.title,description:write.intro,alternates:{canonical:'/write'}};}
export default async function WritePage(){const content=await getSiteContent();return <div className="container page-section"><div className="write-heading"><div><h1>{content.write.title}</h1><p>{content.write.intro}</p></div><Sprout/></div><SubmissionForm copy={content.write}/><p className="privacy-copy">{content.write.disclosure}</p></div>;}
