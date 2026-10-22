import styles from './garden.module.css';

/** One large plant, drawn as a brand mark. Its brief growth sequence settles. */
export function Garden() {
  return <svg className={styles.garden} viewBox="0 0 480 600" fill="none" aria-hidden="true" focusable="false" data-testid="hero-garden">
    <g className={styles.plant}>
      <path className={styles.stem} d="M241 501C221 399 254 326 250 274" stroke="var(--deep-teal)" strokeWidth="14" strokeLinecap="round"/>
      <g className={styles.left}>
        <path d="M239 371C127 390 54 318 64 218C167 204 247 266 239 371Z" fill="var(--teal)"/>
        <path d="M106 259C153 284 204 327 239 371" stroke="var(--deep-teal)" strokeWidth="5" strokeLinecap="round"/>
      </g>
      <g className={styles.right}>
        <path d="M250 274C239 168 306 103 404 114C418 214 357 280 250 274Z" fill="var(--deep-teal)"/>
        <path d="M250 274C284 233 322 191 363 153" stroke="var(--teal)" strokeWidth="5" strokeLinecap="round"/>
      </g>
    </g>
    <g className={styles.pot}>
      <path d="M151 482H329L311 563C305 589 176 589 170 563Z" fill="var(--orange)"/>
      <path d="M143 468C198 456 282 456 337 468L333 496C278 508 202 508 147 496Z" fill="var(--accent)"/>
    </g>
  </svg>;
}
