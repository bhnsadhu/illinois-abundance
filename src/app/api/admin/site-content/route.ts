import { revalidatePath,revalidateTag } from 'next/cache';
import { getReviewer } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin-access';
import { serviceDatabase } from '@/lib/database/service';
import { apiFailure,guardRateLimit,HttpError,privateJson,readJson,requireOrigin } from '@/lib/api';
import { parseSiteSection,siteContentMutationSchema } from '@/lib/site-content-schema';
export async function POST(request:Request){try{
 requireOrigin(request);
 const actor=await getReviewer();if(!actor)throw new HttpError('Sign in as an admin to edit the site.',401);
 if(!actor.isAdmin||!isAdminEmail(actor.email))throw new HttpError('Only an admin can edit site content.',403);
 const input=siteContentMutationSchema.parse(await readJson(request,120000));
 const values=parseSiteSection(input.section,input.values);
 await guardRateLimit('site-content-save',actor.id,120,300);
 const {data,error}=await serviceDatabase().rpc<{status:string;version:number}>('save_site_content',{p_section:input.section,p_values:values,p_expected_version:input.version});
 if(error)throw new HttpError('Could not save these changes. Please try again.',503);
 if(data?.status==='conflict')throw new HttpError('Another admin changed this section. Reload the page before saving again.',409);
 if(data?.status!=='ok')throw new HttpError('Could not save these changes.',503);
 revalidateTag('site-content',{expire:0});revalidatePath('/','layout');
 return privateJson({ok:true,version:data.version});
}catch(error){return apiFailure(error);}}
