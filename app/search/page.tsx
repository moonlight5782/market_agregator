import { getAvailableCities, searchCatalog } from "../../lib/catalog-data";

function stockLabel(status: string, quantity?: number | null) {
  if (status === "OUT_OF_STOCK" || quantity === 0) return "Нет в наличии";
  if (status === "PREORDER") return "Предзаказ";
  if (quantity != null && quantity > 0 && quantity <= 10) return `В наличии · ${quantity} шт.`;
  if (status === "IN_STOCK" || status === "LOW_STOCK" || (quantity != null && quantity > 10)) return "В наличии";
  return "Наличие уточняется";
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string; city?: string }> }) {
  const { q = "", sort = "price-asc", city = "" } = await searchParams;
  const [result, cities] = await Promise.all([searchCatalog(q, sort, city), getAvailableCities()]);
  const citySuffix = city ? ` · ${city}` : "";

  return (
    <main className="page-shell">
      <a href="/" style={{ color: "#111", textDecoration: "none" }}>← Главная</a>
      <div style={{ marginTop: 12 }}><h1 style={{ fontSize: "clamp(30px,8vw,38px)", marginBottom: 6 }}>Поиск: {q || "все товары"}</h1><div style={{ color: "#666" }}>{result.products.length} результатов{citySuffix} {result.mode === "demo" ? "· demo data" : ""}</div></div>
      <form className="search-form">
        <input name="q" defaultValue={q} placeholder="Что вы ищете?" style={{ padding: 15, border: "1px solid #ccc", borderRadius: 12, fontSize: 16, minWidth: 0 }} />
        <select name="city" defaultValue={city} aria-label="Город" style={{ padding: 14, border: "1px solid #ccc", borderRadius: 12, background: "white" }}>
          <option value="">Вся Молдова</option>
          {cities.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select name="sort" defaultValue={sort} style={{ padding: 14, border: "1px solid #ccc", borderRadius: 12, background: "white" }}><option value="price-asc">Сначала дешевле</option><option value="price-desc">Сначала дороже</option></select>
        <button className="touch-target" style={{ padding: "0 22px", border: 0, borderRadius: 12, background: "#111", color: "white", fontWeight: 800 }}>Применить</button>
      </form>

      <div style={{ display: "grid", gap: 20 }}>
        {result.products.map((product: any) => {
          const offers = product.offers;
          const best = offers[0];
          const imageUrl = product.imageUrl || best?.imageUrl;
          const category = result.mode === "demo" ? product.categoryName : product.category?.nameRu;
          const brand = result.mode === "demo" ? product.brand : product.brand?.name;
          const productUrl = `/product/${product.slug}${city ? `?city=${encodeURIComponent(city)}` : ""}`;
          return (
            <article key={product.id} className="search-result">
              <a href={productUrl} className="search-result__image">{imageUrl && <img src={imageUrl} alt={product.title} style={{ width: "100%", height: "100%", maxHeight: 230, objectFit: result.mode === "demo" ? "cover" : "contain" }} />}</a>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#777", fontSize: 14 }}>{category ?? "Без категории"} {brand ? `• ${brand}` : ""}</div>
                <h2 style={{ margin: "7px 0", overflowWrap: "anywhere" }}><a href={productUrl} style={{ color: "inherit", textDecoration: "none" }}>{product.title}</a></h2>
                {best && <div style={{ fontSize: 25, fontWeight: 900, marginBottom: 15 }}>от {Number(best.price).toLocaleString("ru-RU")} {best.currency}</div>}
                <div style={{ display: "grid", gap: 7 }}>
                  {offers.map((offer: any) => {
                    const branch = offer.availabilities?.[0];
                    const status = branch?.stockStatus ?? offer.stockStatus;
                    const quantity = branch?.quantity ?? offer.quantity;
                    const location = branch?.location ?? offer.location;
                    return (
                      <div key={offer.id} className="search-offer">
                        <div><b>{offer.store.name}</b>{location && <div style={{ color: "#666", fontSize: 13 }}>{location.city}{location.address ? `, ${location.address}` : ""}</div>}{!location && city && <div style={{ color: "#666", fontSize: 13 }}>{city}</div>}</div>
                        <div style={{ color: status === "OUT_OF_STOCK" ? "#888" : "#333", fontSize: 14 }}>{stockLabel(status, quantity)}</div>
                        <div><div style={{ textAlign: "right" }}>{offer.oldPrice && <div style={{ color: "#999", fontSize: 13, textDecoration: "line-through" }}>{Number(offer.oldPrice).toLocaleString("ru-RU")} {offer.currency}</div>}<b>{Number(offer.price).toLocaleString("ru-RU")} {offer.currency}</b></div></div>
                        <a href={offer.externalUrl} target="_blank" rel="noreferrer" className="search-offer__cta touch-target">В магазин ↗</a>
                      </div>
                    );
                  })}
                </div>
                <a href={productUrl} style={{ display: "inline-block", marginTop: 14, color: "#111", fontWeight: 800 }}>Открыть карточку и сравнить →</a>
              </div>
            </article>
          );
        })}
        {result.products.length === 0 && <p>Ничего не найдено для выбранных условий.</p>}
      </div>
    </main>
  );
}
