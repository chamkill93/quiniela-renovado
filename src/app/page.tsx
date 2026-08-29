import { HomeHero } from "@/features/product/home-hero";
import { HomeSections } from "@/features/product/home-sections";
import styles from "@/features/product/product.module.css";

export default function HomePage() {
  return (
    <main className={`${styles.page} ${styles.homePage}`}>
      <HomeHero />
      <HomeSections />
    </main>
  );
}
