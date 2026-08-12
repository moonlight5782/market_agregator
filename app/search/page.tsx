import { getAvailableCities, searchCatalog } from "../../lib/catalog-data";
import { getLocale } from "../../lib/get-locale";
import { demoCategoryName, getDictionary, numberLocale, stockLabel } from "../../lib/i18n";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string; city?: string }> }) {
  const [{ q = "", sort = "price-asc", city = "" }, locale] = await Promise.all([searchParams, getLocale()]);
  const t = getDictionary(locale);
  const [result, cities] = await Promise.all([searchCatalog(q, sort, city), getAvailableCities()]);
  const citySuffix = city ? ` · ${city}` : "";

  return (
    <main className="page-shell" style={{ paddingTop: 72 }}>
      <a href="/" style={{ color: "#111", textDecoration: "none" }}>← {t.home}</a>
      <div style={{ marginTop: 12 }}><h1 style={{ fontSize: "clamp(30px,8vw,38px)", marginBottom: 6 }}>{t.search}: {q || t.searchAllProducts}</h1><div style={{ color: "#666" }}>{result.products.length} {t.results}{citySuffix} {result.mode === "demo" ? `· ${t.demoData}` : ""}</div></div>
      <form className="search-form">
        <input name="q" defaultValue={q} placeholder={t.searchPlaceholder} style={{ padding: 15, border: "1px solid #ccc", borderRadius: 12, fontSize: 16, minWidth: 0 }} />
        <select name="city" defaultValue={city} aria-label={t.city} style={{ padding: 14, border: "1px solid #ccc", borderRadius: 12, background: "white" }}>
          <option value="">{t.allMoldova}</option>
          {cities.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select name="sort" defaultValue={sort} style={{ padding: 14, border: "1px solid #ccc", borderRadius: 12, background: "white" }}><option value="price-asc">{t.sortCheap}</option><option value="price-desc">{t.sortExpensive}</option></select>
        <button className="touch-target" style={{ padding: "0 22px", border: 0, borderRadius: 12, background: "#111", color: "white", fontWeight: 800 }}>{t.apply}</button>
      </form>

      <div style={{ display: "grid", gap: 20 }}>
        {result.products.map((product: any) => {
          const offers = product.offers;
          const best = offers[0];
          const imageUrl = product.imageUrl || best?.imageUrl;
          const category = result.mode === "demo"
            ? demoCategoryName(product.categorySlug, locale, product.categoryName)
            : (locale === "ro" ? product.category?.nameRo || product.category?.nameRu : product.category?.nameRu);
          const brand = result.mode === "demo" ? product.brand : product.brand?.name;
          const productUrl = `/product/${product.slug}${city ? `?city=${encodeURIComponent(city)}` : ""}`;
          return (
            <article key={product.id} className="search-result">
              <a href={productUrl} className="search-result__image">{imageUrl ? <img src={imageUrl} alt={product.title} style={{ width: "100%", height: "100%", maxHeight: 230, objectFit: result.mode === "demo" ? "cover" : "contain" }} /> : <span style={{ color: "#888" }}>{t.noImage}</span>}</a>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#777", fontSize: 14 }}>{category ?? t.noCategory} {brand ? `• ${brand}` : ""}</div>
                <h2 style={{ margin: "7px 0", overflowWrap: "anywhere" }}><a href={productUrl} style={{ color: "inherit", textDecoration: "none" }}>{product.title}</a></h2>
                {best && <div style={{ fontSize: 25, fontWeight: 900, marginBottom: 15 }}>{t.from} {Number(best.price).toLocaleString(numberLocale(locale))} {best.currency}</div>}
                <div style={{ display: "grid", gap: 7 }}>
                  {offers.map((offer: any) => {
                    const branch = offer.availabilities?.[0];
                    const location = branch?.location ?? offer.location;
                    const cityStockUnverified = Boolean(city && !branch && !offer.location);
                    const status = cityStockUnverified ? "UNKNOWN" : (branch?.stockStatus ?? offer.stockStatus);
                    const quantity = cityStockUnverified ? null : (branch?.quantity ?? offer.quantity);
                    return (
                      <div key={offer.id} className="search-offer">
                        <div><b>{offer.store.name}</b>{location && <div style={{ color: "#666", fontSize: 13 }}>{location.city}{location.address ? `, ${location.address}` : ""}</div>}{!location && city && <div style={{ color: "#666", fontSize: 13 }}>{city} · {t.localStockUnknown}</div>}</div>
                        <div style={{ color: status === "OUT_OF_STOCK" ? "#888" : "#333", fontSize: 14 }}>{stockLabel(status, quantity, locale)}</div>
                        <div><div style={{ textAlign: "right" }}>{offer.oldPrice && <div style={{ color: "#999", fontSize: 13, textDecoration: "line-through" }}>{Number(offer.oldPrice).toLocaleString(numberLocale(locale))} {offer.currency}</div>}<b>{Number(offer.price).toLocaleString(numberLocale(locale))} {offer.currency}</b></div></div>
                        <a href={offer.externalUrl} target="_blank" rel="noreferrer" className="search-offer__cta touch-target">{t.toStore}</a>
                      </div>
                    );
                  })}
                </div>
                <a href={productUrl} style={{ display: "inline-block", marginTop: 14, color: "#111", fontWeight: 800 }}>{t.openCompare}</a>
              </div>
            </article>
          );
        })}
        {result.products.length === 0 && <p>{t.nothingFound}</p>}
      </div>
    </main>
  );
}
