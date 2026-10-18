import { Garden } from './garden';
import styles from './home-title.module.css';

export function HomeTitle({firstLine='Champaign Urbana.',secondLine='Cultivating Our Garden'}:{firstLine?:string;secondLine?:string}) {
  return <h1 className={styles.title}>
    <span className={styles.line}>{firstLine}</span>
    <span className={styles.gardenLine}><span className={styles.accent}>{secondLine}</span><Garden/></span>
  </h1>;
}
