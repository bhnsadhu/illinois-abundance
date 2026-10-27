import { z } from 'zod';
import { siteContentDefaults, siteSections, sectionFields, type ContentField, type SiteSection } from './site-content-model';
export { siteContentDefaults, siteSections, sectionFields, sectionLabels, contentVisibility, type ContentField, type SiteContent, type SiteSection } from './site-content-model';

export const siteSectionSchema = z.enum(siteSections);
export const imagePathSchema=z.string().max(2000).refine(value=>value===''||/^\/(?:brand|illustrations)\/[a-zA-Z0-9._-]+\.(?:png|jpg|webp|svg)$/.test(value)||/^\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/.test(value),'Upload an image or use an existing site image.');
export const contentLinkSchema=z.string().max(2000).refine(value=>{
  if(/[\s\\\u0000-\u001f\u007f]/.test(value))return false;
  if(value.startsWith('/')&&!value.startsWith('//'))return true;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}
},'Use a site path starting with / or an https link.');
function fieldSchema(field:ContentField):z.ZodType{
  if(field.type==='toggle')return z.boolean();
  if(field.type==='list')return z.array(objectSchema(field.fields!)).max(12);
  if(field.type==='image')return imagePathSchema;
  if(field.type==='link')return contentLinkSchema;
  if(field.type==='email')return z.email().max(254);
  return z.string().trim().max(field.max).min(field.type==='textarea'?0:1);
}
function objectSchema(fields:ContentField[]){return z.object(Object.fromEntries(fields.map(field=>[field.key,fieldSchema(field)]))).strict();}
export function parseSiteSection(section:SiteSection,value:unknown):Record<string,unknown>{return objectSchema(sectionFields[section]).parse(value);}
export const siteContentMutationSchema=z.object({section:siteSectionSchema,version:z.number().int().nonnegative(),values:z.record(z.string(),z.unknown())}).strict();


/** Carry forward previous shipped defaults while preserving custom editorial copy. */
export function upgradeLegacySiteSection(section: SiteSection, values: Record<string, unknown>) {
  const updated = {...values};
  if (section === 'home') {
    if (updated.imageUrl === '/illustrations/housing.svg') updated.imageUrl = siteContentDefaults.home.imageUrl;
    if (updated.secondLine === 'With room for more.' || updated.secondLine === 'Cultivating our Garden') updated.secondLine = siteContentDefaults.home.secondLine;
    if (updated.secondaryLabel === 'Come to a campus event' && updated.secondaryHref === '/events') {
      updated.secondaryLabel = siteContentDefaults.home.secondaryLabel;
      updated.secondaryHref = siteContentDefaults.home.secondaryHref;
    }
    if (['Write the stories', 'Publish with us', 'Publish With Us'].includes(String(updated.secondaryLabel)) && updated.secondaryHref === '/write') updated.secondaryLabel = siteContentDefaults.home.secondaryLabel;
    if (updated.primaryLabel === 'Read the stories' && updated.primaryHref === '/latest') updated.primaryLabel = siteContentDefaults.home.primaryLabel;
    if (updated.eventLabel === 'Next campus event') updated.eventLabel = siteContentDefaults.home.eventLabel;
  }
  if (section === 'navigation' && ['Write for us', 'Publish with us', 'Publish With Us'].includes(String(updated.writeLabel)) && updated.writeHref === '/write') updated.writeLabel = siteContentDefaults.navigation.writeLabel;
  if (section === 'navigation' && Array.isArray(updated.links)) {
    // Add News to saved shipped menus, leaving editorially customized menus intact.
    const previousLinks = siteContentDefaults.navigation.links.filter(link => link.href !== '/news');
    const previousVisibleLinks = previousLinks.filter(link => !['/learn', '/show-up'].includes(link.href));
    const matches = (links: typeof previousLinks) => updated.links instanceof Array && updated.links.length === links.length && updated.links.every((link, index) => link?.label === links[index].label && link?.href === links[index].href);
    if (matches(previousLinks) || matches(previousVisibleLinks)) {
      updated.links = [...updated.links.slice(0, 1), { label: 'News', href: '/news' }, ...updated.links.slice(1)];
    }
  }
  if (section === 'branding' && updated.faviconUrl === '/brand/favicon.png') updated.faviconUrl = siteContentDefaults.branding.faviconUrl;
  if (section === 'branding' && ['Champaign Urbana. With room for more.', 'Champaign Urbana. Cultivating our Garden'].includes(String(updated.shareTitle))) updated.shareTitle = siteContentDefaults.branding.shareTitle;
  const previousGardenCopy: Partial<Record<SiteSection, Record<string, string>>> = {
    home: { recentTitle: 'Recent writing' },
    about: { writeTitle: 'Write for us' },
    write: { title: 'Write for Illinois Abundance.', successBody: 'One of our reviewers will contact you soon.' },
    events: { intro: 'Campus conversations and gatherings hosted by Illinois Abundance.' },
    newsletter: { homeTitle: 'Good ideas. In your inbox.' },
  };
  for (const [key, previous] of Object.entries(previousGardenCopy[section] || {})) {
    if (updated[key] === previous) updated[key] = (siteContentDefaults[section] as Record<string, unknown>)[key];
  }
  // Only expand the original About section; never append to an editor's custom sections.
  if (section === 'about' && Array.isArray(updated.sections) && updated.sections.length === 1) {
    const first = updated.sections[0];
    const original = siteContentDefaults.about.sections[0];
    if (first?.title === original.title && first?.body === original.body) updated.sections = structuredClone(siteContentDefaults.about.sections);
  }
  return updated;
}
