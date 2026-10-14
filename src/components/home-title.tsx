import { Fragment } from 'react';
import styles from './home-title.module.css';

const letterStep = 50;
const linePause = 150;

function writtenLine(text: string, start: number, step: number) {
  let position = 0;
  return text.split(' ').map((word, wordIndex) => {
    const letters = [...word].map(letter => {
      const index = position++;
      return <span className={styles.letter} style={{ animationDelay: `${start + index * step}ms` }} key={index}>{letter}</span>;
    });
    // A real space keeps copying and word wrapping natural; the word spans
    // prevent the heading from wrapping in the middle of a word on phones.
    position++;
    return <Fragment key={wordIndex}>{wordIndex > 0 && ' '}<span className={styles.word}>{letters}</span></Fragment>;
  });
}

export function HomeTitle({firstLine='Champaign Urbana.',secondLine='With room for more.'}:{firstLine?:string;secondLine?:string}) {
  const step=Math.min(letterStep,2000/(firstLine.length+secondLine.length));
  return <h1 className={styles.title} aria-label={`${firstLine} ${secondLine}`}>
    <span className={styles.line} aria-hidden="true">{writtenLine(firstLine, 0, step)}</span>
    <span className={`${styles.line} ${styles.accent}`} aria-hidden="true">{writtenLine(secondLine, firstLine.length * step + linePause, step)}</span>
  </h1>;
}
