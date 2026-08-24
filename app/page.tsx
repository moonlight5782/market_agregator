import { ProductCard } from "../components/ProductCard";
import LocationFilter from "../components/LocationFilter";
import { getHomeData } from "../lib/catalog-data";
import { getLocale } from "../lib/get-locale";
import { demoCategoryName, getDictionary } from "../lib/i18n";

const categoryIcons: Record<string, string> = {
  electronics: "⌁", groceries: "●", food: "●", home: "⌂", construction: "◇",
  "home-appliances": "▣", fashion: "♢", beauty: "✦", kids: "☺", sport: "○",
  auto: "◉", pets: "♧", garden: "❋", office: "□", "books-hobby": "▤",
};

export default async function Home() {
  const [data, locale] = await Promise.all([getHomeData(), getLocale()]);
  const t = getDictionary(locale);

  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero__content">
          {data.mode === "demo" && <div className="demo-badge">{t.demoData}</div>}
          <p className="eyebrow">MOLDOVA COMMERCE</p>
          <h1>{t.heroTitle}</h1>
          <p className="home-hero__text">{t.heroText}</p>
          <form action="/search" className="hero-search">
            <label className="search-input-wrap">
              <span aria-hidden="true">⌕</span>
              <input name="q" placeholder={t.heroPlaceholder} aria-label={t.search} />
            </label>
            <button className="button button--primary">{t.find}</button>
          </form>
          <form action="/search" className="hero-location">
            <input type="hidden" name="sort" value="nearest" />
            <LocationFilter labels={{ useLocation: t.useLocation, locating: t.locating, locationReady: t.locationReady, locationError: t.locationError, clearLocation: t.clearLocation, radius: t.radius }} />
          </form>
        </div>
      </section>

      <div className="home-stats" aria-label={t.trustedData}>
        <div><strong>{data.storeCount}</strong><span>{t.stores}</span></div>
        <div><strong>{data.productCount}</strong><span>{t.products}</span></div>
        <div><strong>{data.offerCount}</strong><span>{t.offers}</span></div>
      </div>

      <section className="home-section">
        <div className="section-heading"><div><p className="eyebrow">{t.catalog}</p><h2>{t.categories}</h2></div><Link href="/search">{t.search} →</Link></div>
        <div className="category-grid">
          {data.categories.map((category: any) => {
            const name = data.mode === "demo" ? demoCategoryName(category.slug, locale, category.nameRu) : (locale === "ro" ? category.nameRo || category.nameRu : category.nameRu);
            return <Link href={`/category/${category.slug}`} key={category.slug} className="category-tile"><span className="category-tile__icon" aria-hidden="true">{categoryIcons[category.slug] ?? "□"}</span><span>{name}</span><span aria-hidden="true">›</span></Link>;
          })}
        </div>
      </section>

      <section className="home-section home-section--tinted">
        <div className="section-heading"><div><p className="eyebrow">{t.bestPrice}</p><h2>{t.popularOffers}</h2><p>{t.popularOffersText}</p></div></div>
        <div className="catalog-grid">{data.latestProducts.map((product: any) => <ProductCard key={product.id} product={product} mode={data.mode} locale={locale} />)}</div>
      </section>

      <section className="trust-strip">
        <div><span aria-hidden="true">✓</span><div><strong>{t.trustedData}</strong><p>{t.trustedDataText}</p></div></div>
        <div><span aria-hidden="true">↗</span><div><strong>{t.toStore.replace(" ↗", "")}</strong><p>{t.externalCheckout}</p></div></div>
      </section>
    </main>
  );
}
import Link from "next/link";
