import styles from './garden-border.module.css';

/** A shared garden at the end of each page: seeds, shoots, and established plants. */
export function GardenBorder() {
  return <div className={`container ${styles.border}`} aria-hidden="true">
    <svg viewBox="0 0 1200 100" fill="none" preserveAspectRatio="xMidYMax slice" focusable="false">
      <path d="M0 83C150 74 259 93 394 84s231-10 366-1 287-7 440 1v16H0Z" fill="var(--soft-teal)" opacity=".42"/>
      <g stroke="var(--deep-teal)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity=".52">
        <path d="M0 83c150-9 259 10 394 1s231-10 366-1 287-7 440 1" opacity=".38"/>
        <path d="M72 80c2-18-1-36-7-51m5 28C50 57 41 47 41 34c18 0 29 8 29 23Zm1-13c0-19 12-31 29-32 0 18-10 31-29 32Z" fill="var(--soft-teal)"/>
        <path d="m48 41 22 16m1-13 21-24M194 82V66m0 7c-12 0-20-7-20-17 12 0 20 7 20 17Zm0-7c0-13 8-21 20-21 0 12-7 21-20 21Z"/>
        <path d="M582 79V51m0 13c-20 1-31-10-32-25 20-1 32 9 32 25Zm0-10c0-20 12-33 32-34 1 20-11 33-32 34Z" fill="var(--soft-teal)"/>
        <path d="m559 46 23 18m0-10 23-25M631 79c0-9 2-17 7-23"/>
        <path d="M1010 82c-5-21-2-43 8-64m-11 45c-24-2-34-15-32-32 22 2 33 14 32 32Zm4-21c2-18 15-28 33-27-2 17-14 28-33 27Z" fill="var(--soft-teal)"/>
        <path d="m983 39 24 24m4-21 24-20M1137 80V61m0 8c-13 0-21-8-21-18 13 0 21 7 21 18Zm0-8c0-13 8-22 21-23 1 14-8 22-21 23Z"/>
      </g>
      <g fill="var(--accent)" opacity=".5">
        <ellipse cx="355" cy="83" rx="3" ry="1.6" transform="rotate(-25 355 83)"/>
        <ellipse cx="817" cy="86" rx="3" ry="1.6" transform="rotate(25 817 86)"/>
      </g>
    </svg>
  </div>;
}
