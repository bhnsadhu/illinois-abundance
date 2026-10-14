import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from '@/components/icons';
import { content } from '@/lib/content';

export const metadata: Metadata = { title: 'About us', description: content.about.intro, alternates: { canonical: '/about' } };

export default function AboutPage() {
  return <div className="container about-page">
    <header className="about-hero"><div><h1>{content.about.title}</h1><p>{content.about.intro}</p><a className="text-link" href="https://www.instagram.com/illinoisabundance/" target="_blank" rel="noopener noreferrer">Follow us on Instagram <ArrowUpRight size={16}/><span className="sr-only"> (opens in a new tab)</span></a></div><div className="about-hero-art"><Image src="/illustrations/housing.svg" width={800} height={560} alt="A welcoming neighborhood with homes, a bicycle, and a tree" priority sizes="(max-width: 767px) 100vw, 50vw"/></div></header>
    <div className="about-sections">{content.about.sections.map(section => <section key={section.title} className="about-section"><h2>{section.title}</h2><p>{section.body}</p></section>)}</div>
    <section className="about-write"><div><h2>Write for us</h2></div><div><ol>{content.about.steps.map(step => <li key={step}>{step}</li>)}</ol><Link className="button" href="/write">Start writing <ArrowRight size={16}/></Link></div></section>
  </div>;
}
