import Link from "next/link";
import { ProductCard } from "../components/ProductCard";
import LocationFilter from "../components/LocationFilter";
import { getAvailableStores, getHomeData } from "../lib/catalog-data";
import { getLocale } from "../lib/get-locale";
import { demoCategoryName, getDictionary } from "../lib/i18n";

const categoryIcons: Record<string, string> = {
  electronics: "⌁", groceries: "◒", food: "◒", home: "⌂", construction: "◇",
  "home-appliances": "▣", fashion: "♢", beauty: "✦", kids: "☺", sport: "○",
  auto: "◉", pets: "♧", garden: "❋", office: "□", "books-hobby": "▤",
  baby: "☺", produce: "◒", "meat-fish": "◇", dairy: "◉", drinks: "◌", alcohol: "♢", sweets: "✦",
};

export default async function Home() {
  const [data, stores, locale] = await Promise.all([getHomeData(), getAvailableStores(), getLocale()]);
  const t = getDictionary(locale);
  const ru = locale === "ru";

  return (
    <main className="home-page">
      <section className="hero-stage">
        <div className="hero-stage__glow" />
        <div className="hero-stage__content">
          <div className="hero-stage__topline">
            <span className="live-pill"><i /> {ru ? "Цены по всей Молдове" : "Prețuri din toată Moldova"}</span>
            {data.mode === "demo" && <span className="demo-pill">{t.demoData}</span>}
          </div>
          <p className="hero-stage__eyebrow">BUN PREȚ · SMART SHOPPING</p>
          <h1>{ru ? <>Плати за товар.<br/><em>Не переплачивай.</em></> : <>Plătește produsul.<br/><em>Nu plăti în plus.</em></>}</h1>
          <p className="hero-stage__lead">{t.heroText}</p>
          <form action="/search" className="hero-search">
            <label className="search-input-wrap">
              <span aria-hidden="true">⌕</span>
              <input name="q" placeholder={t.heroPlaceholder} aria-label={t.search} />
            </label>
            <button className="button button--accent">{t.find}<span aria-hidden="true">→</span></button>
          </form>
          <div className="popular-searches">
            <span>{ru ? "Ищут сейчас:" : "Căutări populare:"}</span>
            <Link href="/search?q=iPhone">iPhone</Link><Link href="/search?q=кофе">{ru ? "кофе" : "cafea"}</Link><Link href="/search?q=штукатурка">{ru ? "штукатурка" : "tencuială"}</Link>
          </div>
          <form action="/search" className="hero-location">
            <input type="hidden" name="sort" value="nearest" />
            <LocationFilter labels={{ useLocation: t.useLocation, locating: t.locating, locationReady: t.locationReady, locationError: t.locationError, clearLocation: t.clearLocation, radius: t.radius }} />
          </form>
        </div>
        <aside className="hero-price-card" aria-hidden="true">
          <div className="hero-price-card__label">BEST PRICE</div>
          <div className="hero-price-card__visual"><span>−18%</span><b>29<sup>95</sup></b><small>MDL</small></div>
          <div className="hero-price-card__shops"><span>METRO</span><span>LINELLA</span><span>KAUFLAND</span></div>
          <p>{ru ? "Одна покупка. Три цены." : "O achiziție. Trei prețuri."}</p>
        </aside>
      </section>

      <div className="metric-ribbon" aria-label={t.trustedData}>
        <div><strong>{data.storeCount}</strong><span>{t.stores}</span></div>
        <div><strong>{data.productCount}</strong><span>{t.products}</span></div>
        <div><strong>{data.offerCount}</strong><span>{t.offers}</span></div>
        <div className="metric-ribbon__promise"><i>✓</i><span>{ru ? "Цена и наличие в одном месте" : "Preț și stoc într-un singur loc"}</span></div>
      </div>

      <section className="store-rail" aria-label={t.store}>
        <span>{ru ? "Выберите магазин" : "Alege magazinul"}</span>
        <div>{stores.map((item) => <Link key={item.slug} href={`/search?store=${item.slug}`}>{item.name}<i>↗</i></Link>)}</div>
      </section>

      <section className="home-section category-section">
        <div className="section-heading">
          <div><p className="section-number">01 / {t.catalog}</p><h2>{ru ? "От помидоров до перфоратора" : "De la roșii la rotopercutor"}</h2></div>
          <Link href="/search" className="arrow-link">{ru ? "Весь каталог" : "Tot catalogul"}<span>↗</span></Link>
        </div>
        <div className="category-grid">
          {data.categories.map((category: any, index: number) => {
            const name = data.mode === "demo" ? demoCategoryName(category.slug, locale, category.nameRu) : (locale === "ro" ? category.nameRo || category.nameRu : category.nameRu);
            return <Link href={`/category/${category.slug}`} key={category.slug} className={`category-tile category-tile--${index % 4}`}><span className="category-tile__icon" aria-hidden="true">{categoryIcons[category.slug] ?? "□"}</span><span className="category-tile__copy"><b>{name}</b><small>{ru ? "Смотреть цены" : "Vezi prețurile"}</small></span><span className="category-tile__arrow" aria-hidden="true">↗</span></Link>;
          })}
        </div>
      </section>

      <section className="offers-stage">
        <div className="home-section">
          <div className="section-heading section-heading--light">
            <div><p className="section-number">02 / {t.bestPrice}</p><h2>{t.popularOffers}</h2><p>{t.popularOffersText}</p></div>
            <Link href="/search?sort=price-asc" className="arrow-link">{ru ? "Сначала дешевле" : "Mai întâi ieftine"}<span>→</span></Link>
          </div>
          <div className="catalog-grid">{data.latestProducts.map((product: any) => <ProductCard key={product.id} product={product} mode={data.mode} locale={locale} />)}</div>
        </div>
      </section>

      <section className="home-section how-section">
        <div className="section-heading"><div><p className="section-number">03 / BUN PREȚ</p><h2>{ru ? "Сравнить проще, чем переплачивать" : "E mai simplu să compari decât să plătești în plus"}</h2></div></div>
        <div className="how-grid">
          <article><span>01</span><i>⌕</i><h3>{ru ? "Найдите товар" : "Găsiți produsul"}</h3><p>{ru ? "Ищите сразу по каталогам магазинов Молдовы." : "Căutați simultan în cataloagele magazinelor din Moldova."}</p></article>
          <article><span>02</span><i>≋</i><h3>{ru ? "Сравните варианты" : "Comparați opțiunile"}</h3><p>{ru ? "Цена, наличие, филиал и расстояние — на одном экране." : "Preț, stoc, filială și distanță — pe un singur ecran."}</p></article>
          <article><span>03</span><i>↗</i><h3>{ru ? "Купите у магазина" : "Cumpărați de la magazin"}</h3><p>{ru ? "Переходите к продавцу и оформляйте покупку напрямую." : "Accesați comerciantul și cumpărați direct."}</p></article>
        </div>
      </section>
    </main>
  );
}
