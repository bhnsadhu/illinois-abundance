import { useId } from 'react';

/** Original logo artwork, sized below its native resolution for crisp display. */
export function BrandPeople({ variant = 'group', className = '' }: { variant?: 'group' | 'neighbor'; className?: string }) {
  const clipId = useId();
  const neighbor = variant === 'neighbor';
  return <svg className={`brand-people ${className}`} data-variant={variant} viewBox={neighbor ? '294 105 120 145' : '150 0 400 250'} width={neighbor ? 120 : 400} height={neighbor ? 145 : 250} aria-hidden="true" focusable="false">
    {neighbor && <defs><clipPath id={clipId}>
      {/* Keep the foreground person and its shadow; exclude the neighbors behind it. */}
      <ellipse cx="356" cy="133" rx="28" ry="27"/>
      <polygon points="328,154 383,154 414,176 414,250 294,250 294,209 307,174"/>
    </clipPath></defs>}
    <image href="/brand/logo-transparent.png" width="714" height="614" clipPath={neighbor ? `url(#${clipId})` : undefined}/>
  </svg>;
}
