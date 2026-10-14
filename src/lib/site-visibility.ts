import 'server-only';
import { publicDatabase } from './database/public';
import { hiddenFeatures } from '@/hidden/features';
import { contentVisibility,parseSiteSection,siteContentDefaults,type SiteContent } from './site-content-schema';
// Proxy performs this small uncached read only for optional feature routes.
// Disabling a feature takes effect before an API can send mail or mutate data.
export async function getUncachedVisibility(){
 const db=publicDatabase();if(!db)return hiddenFeatures;
 const {data,error}=await db.from<{content:Record<string,unknown>}>('public_site_content').select('content').eq('section','visibility').maybeSingle();
 if(error||!data)return hiddenFeatures;
 try{const visibility=parseSiteSection('visibility',{...siteContentDefaults.visibility,...data.content}) as SiteContent['visibility'];return contentVisibility({...siteContentDefaults,visibility});}catch{return hiddenFeatures;}
}
