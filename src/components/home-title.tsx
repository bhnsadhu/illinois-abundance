import { Fragment } from 'react';
import styles from './home-title.module.css';

const firstLine = 'Champaign Urbana.';
const secondLine = 'With room for more.';
const letterStep = 50;
const linePause = 150;

function writtenLine(text: string, start: number) {
  let position = 0;
  return text.split(' ').map((word, wordIndex) => {
    const letters = [...word].map(letter => {
      const index = position++;
      return <span className={styles.letter} style={{ animationDelay: `${start + index * letterStep}ms` }} key={index}>{letter}</span>;
    });
    // A real space keeps copying and word wrapping natural; the word spans
    // prevent the heading from wrapping in the middle of a word on phones.
    position++;
    return <Fragment key={wordIndex}>{wordIndex > 0 && ' '}<span className={styles.word}>{letters}</span></Fragment>;
  });
}

export function HomeTitle() {
  return <h1 className={styles.title} aria-label={`${firstLine} ${secondLine}`}>
    <span className={styles.line} aria-hidden="true">{writtenLine(firstLine, 0)}</span>
    <span className={`${styles.line} ${styles.accent}`} aria-hidden="true">{writtenLine(secondLine, firstLine.length * letterStep + linePause)}</span>
  </h1>;
}
