'use client';

import { useEffect, useRef, type HTMLAttributes } from 'react';

/** A once-only entrance for editorial sections. Server-rendered content stays visible. */
export function Reveal({ children, className = '', ...props }: HTMLAttributes<HTMLElement>) {
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = section.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!element || motion.matches || !('IntersectionObserver' in window)) return;
    // Never hide content already on screen, including restored scroll positions.
    if (element.getBoundingClientRect().top < window.innerHeight) return;

    const reveal = (instant = false) => {
      element.dataset.reveal = instant ? 'instant' : 'visible';
      observer.disconnect();
    };
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) reveal();
    }, { threshold: 0 });
    const onFocus = () => reveal(true);
    const onMotionChange = () => { if (motion.matches) reveal(true); };
    element.dataset.reveal = 'pending';
    observer.observe(element);
    element.addEventListener('focusin', onFocus);
    motion.addEventListener('change', onMotionChange);
    return () => {
      observer.disconnect();
      element.removeEventListener('focusin', onFocus);
      motion.removeEventListener('change', onMotionChange);
      delete element.dataset.reveal;
    };
  }, []);

  return <section {...props} ref={section} className={`reveal ${className}`}>{children}</section>;
}
