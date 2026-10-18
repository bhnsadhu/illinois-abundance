import styles from './home-title.module.css';

export function HomeTitle({firstLine='Champaign Urbana.',secondLine='Cultivating our Garden'}:{firstLine?:string;secondLine?:string}) {
  return <h1 className={styles.title}>
    <span className={styles.line}>{firstLine}</span>
    <span className={`${styles.line} ${styles.accent}`}>{secondLine}</span>
  </h1>;
}
