import styles from './garden.module.css';

/** A single, quiet watering gesture on arrival. The text remains still. */
export function Garden() {
  return <svg className={styles.garden} viewBox="0 0 112 100" fill="none" aria-hidden="true" focusable="false">
    <path d="M13 90c16-3 39-3 57 0" stroke="var(--line)" strokeWidth="2" strokeLinecap="round"/>
    <path d="M28 66h32l-5 22H34z" fill="var(--orange)"/>
    <path d="M25 64c10-2 27-2 38 0v7H25z" fill="var(--accent)"/>
    <g className={styles.plant}>
      <path d="M44 64V37" stroke="var(--deep-teal)" strokeWidth="3" strokeLinecap="round"/>
      <path d="M44 51C28 52 22 43 24 33c13-1 21 6 20 18Z" fill="var(--teal)" stroke="var(--deep-teal)" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M44 43c-1-15 7-23 20-23 1 14-6 24-20 23Z" fill="var(--soft-teal)" stroke="var(--deep-teal)" strokeWidth="2" strokeLinejoin="round"/>
      <path d="m31 40 13 11m0-8 12-14" stroke="var(--deep-teal)" strokeWidth="1.5" strokeLinecap="round"/>
    </g>
    <g className={styles.can}>
      <path d="M89 20c15-9 23 10 9 14" stroke="var(--deep-teal)" strokeWidth="3"/>
      <path d="m76 24-17 3-5-6-4 3 8 12 21-4" fill="var(--teal)" stroke="var(--deep-teal)" strokeWidth="2" strokeLinejoin="round"/>
      <path d="m73 17 22-4 5 25c-6 5-14 7-22 4Z" fill="var(--teal)" stroke="var(--deep-teal)" strokeWidth="2" strokeLinejoin="round"/>
      <path d="m72 17 24-5" stroke="var(--deep-teal)" strokeWidth="3" strokeLinecap="round"/>
    </g>
    <g stroke="var(--deep-teal)" strokeWidth="2" strokeLinecap="round">
      <path className={styles.drop} d="m51 31-2 4"/>
      <path className={`${styles.drop} ${styles.dropTwo}`} d="m57 35-2 4"/>
      <path className={`${styles.drop} ${styles.dropThree}`} d="m63 34-2 4"/>
    </g>
  </svg>;
}
