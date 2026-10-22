import styles from './site-intro.module.css';

/** A brief, dismissible welcome. CSS also guarantees its exit. */
export function SiteIntro({ name }: { name: string }) {
  return <div className={styles.intro} aria-hidden="true" data-testid="site-intro">
    <div className={styles.identity}>
      <svg viewBox="0 0 160 180" fill="none" focusable="false">
        <path className={styles.stem} d="M80 151V70" stroke="currentColor" strokeWidth="10" strokeLinecap="round"/>
        <path className={styles.left} d="M80 105C37 109 15 81 20 41C61 37 86 64 80 105Z" fill="currentColor"/>
        <path className={styles.right} d="M80 77C77 34 103 10 143 16C148 55 121 82 80 77Z" fill="currentColor"/>
        <ellipse cx="80" cy="165" rx="20" ry="7" fill="var(--orange)"/>
      </svg>
      <p>{name}</p>
    </div>
  </div>;
}

// Decide before hydration so repeat visits never flash the splash.
export const introScript = `(() => {
  const root = document.documentElement;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  if (location.pathname !== '/' || location.hash || motion.matches) return;
  try {
    if (sessionStorage.getItem('abundance-welcome-v1')) return;
    sessionStorage.setItem('abundance-welcome-v1', 'seen');
  } catch {}
  root.dataset.intro = 'play';
  root.dataset.arrival = 'intro';
  let coverTimer, finishTimer;
  const finish = () => {
    delete root.dataset.intro;
    delete root.dataset.arrival;
    clearTimeout(coverTimer);
    clearTimeout(finishTimer);
    for (const event of ['keydown', 'wheel', 'touchmove', 'pagehide']) window.removeEventListener(event, finish, true);
    window.removeEventListener('click', onClick, true);
    motion.removeEventListener('change', onMotion);
  };
  const onMotion = () => { if (motion.matches) finish(); };
  const onClick = (event) => {
    // The curtain receives its own dismissal tap, never an obscured link.
    if (event.target instanceof Element && event.target.closest('[data-testid="site-intro"]')) {
      event.preventDefault();
      event.stopPropagation();
    }
    finish();
  };
  for (const event of ['keydown', 'wheel', 'touchmove', 'pagehide']) window.addEventListener(event, finish, { capture: true, passive: true });
  window.addEventListener('click', onClick, true);
  motion.addEventListener('change', onMotion);
  coverTimer = setTimeout(() => { delete root.dataset.intro; }, 1400);
  finishTimer = setTimeout(finish, 3400);
})();`;
