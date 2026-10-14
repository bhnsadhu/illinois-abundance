import type {Metadata} from 'next';
import {SubmissionForm} from '@/components/submission-form';
import {content} from '@/lib/content';
export const metadata:Metadata={title:'Write for us',description:'Share an idea for a better Champaign Urbana. A student reviewer will help you shape it.',alternates:{canonical:'/write'}};
export default function WritePage(){return <div className="container page-section"><div className="write-heading"><div><h1>{content.write.title}</h1><p>{content.write.intro}</p></div></div><SubmissionForm/><p className="privacy-copy">{content.write.disclosure}</p></div>;}
