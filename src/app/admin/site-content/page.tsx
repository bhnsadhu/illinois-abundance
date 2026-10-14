import type {Metadata} from 'next';
import {requireAdmin} from '@/lib/auth';
import {getEditableSiteContent} from '@/lib/site-content';
import {SiteContentEditor} from '@/components/admin/site-content-editor';
export const metadata:Metadata={title:'Site content'};
export default async function SiteContentPage(){await requireAdmin();const {content,versions}=await getEditableSiteContent();return <><div className="desk-heading"><h1>Site content</h1><p>Edit the pages, images, and links your readers see.</p></div><SiteContentEditor initial={content} initialVersions={versions}/></>;}
