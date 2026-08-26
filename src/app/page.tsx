import { HomeRemoteSections } from "@/features/product/catalog-views";
import { HomeHero } from "@/features/product/home-hero";
import styles from "@/features/product/product.module.css";

export default function HomePage() {
  return (
    <main className={`${styles.page} ${styles.pageStack}`}>
      <HomeHero />

      <HomeRemoteSections />
    </main>
  );
}
