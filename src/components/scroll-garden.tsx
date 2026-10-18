import styles from './scroll-garden.module.css';

/** Decorative foliage moves with the reader's scroll, never with a timer. */
export function ScrollGarden() {
  return <div className={styles.garden} aria-hidden="true" data-testid="scroll-garden">
    {Array.from({ length: 6 }, (_, index) => <div className={styles.sprig} key={index}/>)}
  </div>;
}
