import Link from "next/link";
import styles from "./product.module.css";

export function SectionHeader({
  eyebrow,
  title,
  description,
  href,
  linkLabel,
  headingLevel = 1,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <header className={styles.sectionHeader}>
      <div className={styles.sectionCopy}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <Heading className={headingLevel === 1 ? styles.title : styles.sectionTitle}>{title}</Heading>
        {description ? <p className={styles.lede}>{description}</p> : null}
      </div>
      {href && linkLabel ? (
        <Link className={styles.textLink} href={href}>
          {linkLabel} <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </header>
  );
}
