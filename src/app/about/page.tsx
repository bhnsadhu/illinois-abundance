import type { Metadata } from 'next';
import Image from 'next/image';
import { Reveal } from '@/components/reveal';
import { Sprout } from '@/components/sprout';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from '@/components/icons';
import { getSiteContent } from '@/lib/site-content';

export async function generateMetadata():Promise<Metadata>{const content=await getSiteContent();return { title: 'About us', description: content.about.intro, alternates: { canonical: '/about' } };}

export default async function AboutPage() {
  const content=await getSiteContent();
  return <div className="container about-page">
    <header className="about-hero"><div><h1>{content.about.title}</h1><p>{content.about.intro}</p><a className="text-link" href={content.about.socialHref} target="_blank" rel="noopener noreferrer">{content.about.socialLabel} <ArrowUpRight size={16}/><span className="sr-only"> (opens in a new tab)</span></a></div>{content.about.imageUrl&&<div className="about-hero-art"><Image src={content.about.imageUrl} width={800} height={560} alt={content.about.imageAlt} unoptimized loading="eager" sizes="(max-width: 767px) 100vw, 50vw"/></div>}</header>
    <div className="about-sections">{content.about.sections.map(section => <Reveal key={section.title} className="about-section"><h2>{section.title}</h2><p>{section.body}</p></Reveal>)}</div>
    <Reveal className="about-write"><div><h2>{content.about.writeTitle}</h2><Sprout/></div><div><ol>{content.about.steps.map(step => <li key={step.text}>{step.text}</li>)}</ol><Link className="button" href="/write">{content.about.writeLinkLabel} <ArrowRight size={16}/></Link></div></Reveal>
  </div>;
}
