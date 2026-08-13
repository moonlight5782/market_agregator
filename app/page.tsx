import { ProductCard } from "../components/ProductCard";
import { AccountNav } from "../components/AccountNav";
import { getHomeData } from "../lib/catalog-data";
import { getLocale } from "../lib/get-locale";
import { demoCategoryName, getDictionary } from "../lib/i18n";

export default async function Home() {
  const [data, locale] = await Promise.all([getHomeData(), getLocale()]);
  const t = getDictionary(locale);

  return (
    <main style={{ maxWidth: 1220, margin: "0 auto", padding: "72px 20px 56px", fontFamily: "system-ui" }}>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 34, paddingRight: 110, flexWrap: "wrap" }}>
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: ".04em" }}>MOLDOVA COMMERCE</div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}><div style={{ color: "#666", fontSize: 14 }}>Chișinău · 25 km</div><AccountNav /></div>
      </nav>

      <section style={{ background: "linear-gradient(135deg,#f6f6f6,#ececec)", borderRadius: 28, padding: "46px 34px", marginBottom: 34 }}>
        {data.mode === "demo" && <div style={{ display: "inline-block", padding: "7px 11px", borderRadius: 999, background: "#111", color: "#fff", fontSize: 12, fontWeight: 800, marginBottom: 14 }}>DEMO MODE</div>}
        <h1 style={{ fontSize: "clamp(38px,6vw,68px)", lineHeight: 1.02, maxWidth: 900, margin: "0 0 16px" }}>{t.heroTitle}</h1>
        <p style={{ color: "#555", fontSize: 19, maxWidth: 720 }}>{t.heroText}</p>
        <form action="/search" style={{ display: "flex", gap: 10, marginTop: 26, flexWrap: "wrap" }}>
          <input name="q" placeholder={t.heroPlaceholder} style={{ flex: "1 1 360px", padding: 18, border: "1px solid #ccc", borderRadius: 14, fontSize: 17, background: "white" }} />
          <button className="touch-target" style={{ padding: "0 30px", minHeight: 56, border: 0, borderRadius: 14, background: "#111", color: "white", fontWeight: 800, cursor: "pointer" }}>{t.find}</button>
        </form>
        <div style={{ display: "flex", gap: 24, marginTop: 20, color: "#555", flexWrap: "wrap" }}>
          <span><b style={{ color: "#111" }}>{data.storeCount}</b> {t.stores}</span><span><b style={{ color: "#111" }}>{data.productCount}</b> {t.products}</span><span><b style={{ color: "#111" }}>{data.offerCount}</b> {t.offers}</span>
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 28 }}>{t.categories}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>{data.categories.map((category: any) => {
          const name = data.mode === "demo" ? demoCategoryName(category.slug, locale, category.nameRu) : (locale === "ro" ? category.nameRo || category.nameRu : category.nameRu);
          return <a href={`/category/${category.slug}`} key={category.slug} style={{ padding: "12px 16px", background: "#f3f3f3", borderRadius: 999, color: "#111", textDecoration: "none", fontWeight: 650 }}>{name}</a>;
        })}</div>
      </section>

      <section>
        <div><h2 style={{ fontSize: 28, marginBottom: 4 }}>{t.popularOffers}</h2><p style={{ marginTop: 0, color: "#666" }}>{t.popularOffersText}</p></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(255px,1fr))", gap: 18 }}>
          {data.latestProducts.map((product: any) => <ProductCard key={product.id} product={product} mode={data.mode} locale={locale} />)}
        </div>
      </section>
    </main>
  );
}
