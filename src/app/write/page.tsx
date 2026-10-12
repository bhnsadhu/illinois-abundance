import type {Metadata} from 'next';
import {SubmissionForm} from '@/components/submission-form';
import {content} from '@/lib/content';
export const metadata:Metadata={title:'Write for us',description:'Share an idea for a better Champaign Urbana. A student reviewer will help you shape it.',alternates:{canonical:'/write'}};
export default function WritePage(){return <div className="container page-section"><div className="write-heading"><div><span className="eyebrow">STUDENT SUBMISSIONS</span><h1>{content.write.title}</h1><p>{content.write.intro}</p></div><div className="write-process"><span>01 <b>Share your idea</b></span><span>02 <b>Confirm your email</b></span><span>03 <b>Work with a reviewer</b></span></div></div><SubmissionForm/><p className="privacy-copy">{content.write.disclosure}</p></div>;}
