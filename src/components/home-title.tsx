import styles from './home-title.module.css';

function WrittenLine({ text, offset = 0 }: { text: string; offset?: number }) {
  let letter = offset;
  return text.split(/(\s+)/).map((word, index) => /^\s+$/.test(word) ? word : <span className={styles.word} key={index}>
    {Array.from(word).map((character, index) => <span className={styles.ink} style={{ animationDelay: `${900 + letter++ * 34}ms` }} key={index}>{character}</span>)}
  </span>);
}

export function HomeTitle({firstLine='Champaign Urbana.',secondLine='Cultivating Our Garden'}:{firstLine?:string;secondLine?:string}) {
  return <h1 className={styles.title}>
    <span className="sr-only">{firstLine} {secondLine}</span>
    <span className={styles.line} aria-hidden="true"><WrittenLine text={firstLine}/></span>
    <span className={`${styles.line} ${styles.accent}`} aria-hidden="true"><WrittenLine text={secondLine} offset={Array.from(firstLine.replace(/\s/g, '')).length + 3}/></span>
  </h1>;
}
