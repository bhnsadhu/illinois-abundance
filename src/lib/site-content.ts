import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { publicDatabase } from './database/public';
import { serviceDatabase } from './database/service';
import { siteContentDefaults, siteSections, parseSiteSection, type SiteContent, type SiteSection } from './site-content-schema';
export type SiteContentRow={section:SiteSection;content:Record<string,unknown>;version:number};
function mergeContent(rows:SiteContentRow[]):SiteContent{
 const content=structuredClone(siteContentDefaults);
 if(process.env.CONTACT_EMAIL)content.branding.contactEmail=process.env.CONTACT_EMAIL;
 for(const row of rows){if(!siteSections.includes(row.section))continue;try{Object.assign(content[row.section],parseSiteSection(row.section,{...content[row.section],...row.content}));}catch{console.error(`Invalid site content section: ${row.section}`);}}
 return content;
}
export const getSiteContent=cache(unstable_cache(async():Promise<SiteContent>=>{
 const db=publicDatabase();if(!db)return mergeContent([]);
 const {data,error}=await db.from<SiteContentRow>('public_site_content').select('section,content,version');
 if(error)throw new Error('Site content is temporarily unavailable.');
 return mergeContent(data||[]);
},['site-content'],{revalidate:60,tags:['site-content']}));
export async function getEditableSiteContent(){
 const {data,error}=await serviceDatabase().from<SiteContentRow>('site_content').select('section,content,version');
 if(error)throw new Error('Site content is temporarily unavailable.');
 // Content and its versions come from one fresh query, never separate cache snapshots.
 return {content:mergeContent(data||[]),versions:Object.fromEntries((data||[]).map(row=>[row.section,row.version])) as Partial<Record<SiteSection,number>>};
}
