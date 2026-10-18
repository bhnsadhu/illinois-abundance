import { z } from 'zod';
import { content } from './content';
import { localNews } from './local-news';

export const siteContentDefaults = {
  branding: { name: 'Illinois Abundance', description: content.description, contactEmail: 'bhnsadhu@gmail.com', logoUrl: '/brand/logo-wordmark-horizontal.png', logoAlt: 'Illinois Abundance', faviconUrl: '/brand/favicon.png', shareTitle: 'Champaign Urbana. Cultivating our Garden', shareDescription: content.description },
  navigation: { links: [{ label: 'Stories', href: '/latest' }, { label: 'Learn', href: '/learn' }, { label: 'Events', href: '/events' }, { label: 'Show up', href: '/show-up' }, { label: 'About', href: '/about' }], writeLabel: 'Publish with us', writeHref: '/write', contactLabel: 'Contact', reviewerLabel: 'Reviewer sign in', adminLabel: 'Admin sign in', footerLinks: [] as {label:string;href:string}[] },
  home: { firstLine: 'Champaign Urbana.', secondLine: 'Cultivating our Garden', intro: 'Student stories about housing, transit, and life here.\nCampus events hosted by Illinois Abundance.', primaryLabel: 'Read the stories', primaryHref: '/latest', secondaryLabel: 'Publish with us', secondaryHref: '/write', newsTitle: 'Around Champaign Urbana', newsIntro: 'Local reporting worth reading, selected by Illinois Abundance.', newsItems: localNews, recentTitle: 'Fresh from our garden', allStoriesLabel: 'All stories', topicsTitle: 'Topics', writeTitle: 'Write for us', writeDescription: 'Share a local story or idea. A student reviewer will help you get it ready to publish.', writeLinkLabel: 'Send us a piece', writeLinkHref: '/write', eventLabel: 'Our next event', eventEmptyTitle: 'Campus events', eventEmptyBody: 'New dates will appear here when they’re confirmed.', eventLinkLabel: 'View events', eventLinkHref: '/events', emptyTitle: 'Nothing here yet.', emptyBody: 'Have something to say about Champaign Urbana? Send us a piece.', emptyLinkLabel: 'Write for us' },
  about: { title: content.about.title, intro: content.about.intro, socialLabel: 'Follow us on Instagram', socialHref: 'https://www.instagram.com/illinoisabundance/', imageUrl: '/illustrations/housing.svg', imageAlt: 'A welcoming neighborhood with homes, a bicycle, and a tree', sections: content.about.sections, writeTitle: 'Help our garden grow.', steps: content.about.steps.map(text=>({text})), writeLinkLabel: 'Start writing' },
  stories: { title: 'All stories', intro: content.description, topicEmptyTitle: 'No stories yet.', topicEmptyAction: 'Write the first story', emptyTitle: 'Nothing here yet.', emptyBody: 'Send us a piece about a local issue.', emptyAction: 'Write for us', endTitle: 'You’ve reached the end.', backLabel: 'Back to the latest' },
  events: { ...content.events, rsvpLabel:'RSVP',joinLabel:'Join event',calendarLabel:'Add to calendar',recapLabel:'Read the recap', imageUrl: '/illustrations/education.svg', imageAlt: 'Hand drawn books and a notebook' },
  write: { ...content.write, nameLabel: 'Full name', emailLabel: 'Illinois email', bodyLabel: 'Your piece', bodyPlaceholder: 'What could be better about the place we call home?', formatHint: 'Blank lines make paragraphs. Start a subhead with ##.', codeNotice: 'We’ll send a six digit code to confirm your email.', codeButton: 'Send my code', verifyTitle: 'Check your inbox.', verifyIntro: 'Enter the six digit code we sent to your Illinois email. It’s good for ten minutes.', codeLabel: 'Your six digit code', submitLabel: 'Send my piece', resendHint: 'Check your spam folder, or send a new code.', resendLabel: 'Send a new code', backLabel: 'Back to the form', successTitle: 'Submission received.', successBody: 'Thanks for adding your voice to our garden. One of our reviewers will contact you soon.', successLabel: 'Read the latest' },
  search: { ...content.search, placeholder: 'Search housing, buses, energy…', buttonLabel: 'Search', resultsLabel: 'Stories for', previousLabel: 'Previous page', nextLabel: 'Next page' },
  reader: { writtenBy: 'Written by', moreFrom: 'More from', shareTitle: 'Share this story', copyLabel: 'Copy link', copySuccess: 'Link copied', copyError: 'Could not copy. You can copy the address from your browser.', removalLabel: 'Request removal', sourcesLabel: 'Sources', relatedTitle: 'More stories', allStoriesLabel: 'All stories', readStory: 'Read the story', readLatest: 'Read the latest', writerEmpty: content.writer.empty, writerIntro: content.writer.intro },
  access: { adminTitle: 'Admin sign in', reviewerTitle: 'Reviewer sign in', reviewerIntro: 'Sign in with the credentials your admin shared.', emailLabel: 'Email address', passwordLabel: 'Password', adminButton: 'Sign in as admin', reviewerButton: 'Sign in as reviewer', resetHint: 'Need a password reset? Ask your admin.' },
  learn: { ...content.learn, imageUrl:'/illustrations/education.svg',imageAlt:'Hand drawn books and school supplies',readLabel:'Read the guide', allGuidesLabel:'All guides', articleLabel:'Explainer', finishTitle:'Have a question?', finishBody:'Read more student writing or send us a piece about a local issue.' },
  showUp: { ...content.showUp, imageUrl:'/illustrations/infrastructure.svg',imageAlt:'Hand drawn bus and street lights',agendaLabel:'Official agenda' },
  newsletter: { title: 'Subscribe', intro: 'Get new articles and upcoming teach ins by email. Unsubscribe whenever you like.', homeTitle: 'See what’s growing.', homeIntro: 'New writing and upcoming teach ins. Unsubscribe whenever you like.', emailLabel:'Email address', emailPlaceholder:'you@example.com', buttonLabel:'Subscribe', consent:'We’ll email you a confirmation link. Unsubscribe in one click.', successTitle:'Check your inbox.', successBody:'Open the confirmation link to join the list. If you’re already subscribed, you’re all set.', successHint:'Check your spam folder if the email hasn’t arrived.' },
  visibility: { homeFeatured: true, homeRecent: true, homeTopics: true, homeWrite: true, homeEvent: true, homeNewsletter: true, learn: false, meetings: false, newsletter: false, exports: false },
};
export type SiteContent = typeof siteContentDefaults;
export type SiteSection = keyof SiteContent;
export const siteSections = Object.keys(siteContentDefaults) as SiteSection[];
export const siteSectionSchema = z.enum(siteSections);
export type ContentField = { key:string; label:string; type:'text'|'textarea'|'email'|'link'|'image'|'toggle'|'list'; max:number; fields?:ContentField[]; item?:Record<string,unknown> };
export const sectionLabels:Record<SiteSection,string>={branding:'Branding & contact',navigation:'Navigation & footer',home:'Homepage',about:'About',stories:'Story directory',events:'Events',write:'Submissions',search:'Search',reader:'Story & writer pages',access:'Sign-in pages',learn:'Guides',showUp:'Local meetings',newsletter:'Newsletter',visibility:'Section visibility'};
const labelOverrides:Record<string,string>={logoUrl:'Logo',faviconUrl:'Browser icon',imageUrl:'Image',imageAlt:'Image description',logoAlt:'Logo description',contactEmail:'Contact email',newsItems:'Curated news (original summaries and source links)',publisher:'Publication',dateLabel:'Publication date',firstLine:'Title — first line',secondLine:'Title — second line',intro:'Description',href:'Link',socialHref:'Social link',homeFeatured:'Homepage: featured story',homeRecent:'Homepage: recent stories',homeTopics:'Homepage: topics',homeWrite:'Homepage: writing invitation',homeEvent:'Homepage: next event',homeNewsletter:'Homepage: newsletter invitation',learn:'Guides',meetings:'Local meetings',newsletter:'Newsletter',exports:'Content exports'};
const longFields=/intro|description|body|disclosure|consent|hint|notice/i;
function fieldsFor(values:Record<string,unknown>):ContentField[]{return Object.entries(values).map(([key,value])=>{
  const type:ContentField['type']=typeof value==='boolean'?'toggle':Array.isArray(value)?'list':/Url$/.test(key)?'image':/Email$/.test(key)?'email':/Href$|^href$/.test(key)?'link':longFields.test(key)?'textarea':'text';
  const item=Array.isArray(value)?(key==='newsItems'?{title:'',description:'',publisher:'',dateLabel:'',href:'https://'}:(value[0]||{label:'',href:'/'})) as Record<string,unknown>:undefined;
  return {key,label:labelOverrides[key]||key.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase()),type,max:/firstLine|secondLine/.test(key)?100:type==='textarea'?5000:type==='link'||type==='image'?2000:300,...(item?{item,fields:fieldsFor(item)}:{})};
});}
export const sectionFields=Object.fromEntries(siteSections.map(key=>[key,fieldsFor(siteContentDefaults[key])])) as Record<SiteSection,ContentField[]>;
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
export function contentVisibility(content:SiteContent){return {learn:!content.visibility.learn,meetings:!content.visibility.meetings,newsletter:!content.visibility.newsletter,exports:!content.visibility.exports};}

/** Carry forward previous shipped defaults while preserving custom editorial copy. */
export function upgradeLegacySiteSection(section: SiteSection, values: Record<string, unknown>) {
  const updated = {...values};
  if (section === 'home') {
    if (updated.secondLine === 'With room for more.') updated.secondLine = siteContentDefaults.home.secondLine;
    if (updated.secondaryLabel === 'Come to a campus event' && updated.secondaryHref === '/events') {
      updated.secondaryLabel = siteContentDefaults.home.secondaryLabel;
      updated.secondaryHref = siteContentDefaults.home.secondaryHref;
    }
    if (updated.secondaryLabel === 'Write the stories' && updated.secondaryHref === '/write') updated.secondaryLabel = siteContentDefaults.home.secondaryLabel;
    if (updated.eventLabel === 'Next campus event') updated.eventLabel = siteContentDefaults.home.eventLabel;
  }
  if (section === 'navigation' && updated.writeLabel === 'Write for us' && updated.writeHref === '/write') updated.writeLabel = siteContentDefaults.navigation.writeLabel;
  if (section === 'branding' && updated.shareTitle === 'Champaign Urbana. With room for more.') updated.shareTitle = siteContentDefaults.branding.shareTitle;
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
