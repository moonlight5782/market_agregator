import { searchCatalog } from "../../lib/catalog-data";

function stockLabel(status: string, quantity?: number | null) {
  const base = status === "IN_STOCK" ? "В наличии" : status === "LOW_STOCK" ? "Мало" : status === "OUT_OF_STOCK" ? "Нет в наличии" : "Наличие уточняется";
  return quantity != null ? `${base} · ${quantity} шт.` : base;
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const { q = "", sort = "price-asc" } = await searchParams;
  const result = await searchCatalog(q, sort);

  return (
    <main className="page-shell">
      <a href="/" style={{ color: "#111", textDecoration: "none" }}>← Главная</a>
      <div style={{ marginTop: 12 }}><h1 style={{ fontSize: "clamp(30px,8vw,38px)", marginBottom: 6 }}>Поиск: {q || "все товары"}</h1><div style={{ color: "#666" }}>{result.products.length} результатов {result.mode === "demo" ? "· demo data" : ""}</div></div>
      <form className="search-form">
        <input name="q" defaultValue={q} placeholder="Что вы ищете?" style={{ padding: 15, border: "1px solid #ccc", borderRadius: 12, fontSize: 16, minWidth: 0 }} />
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
          return (
            <article key={product.id} className="search-result">
              <a href={`/product/${product.slug}`} className="search-result__image">{imageUrl && <img src={imageUrl} alt={product.title} style={{ width: "100%", height: "100%", maxHeight: 230, objectFit: result.mode === "demo" ? "cover" : "contain" }} />}</a>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#777", fontSize: 14 }}>{category ?? "Без категории"} {brand ? `• ${brand}` : ""}</div>
                <h2 style={{ margin: "7px 0", overflowWrap: "anywhere" }}><a href={`/product/${product.slug}`} style={{ color: "inherit", textDecoration: "none" }}>{product.title}</a></h2>
                {best && <div style={{ fontSize: 25, fontWeight: 900, marginBottom: 15 }}>от {Number(best.price).toLocaleString("ru-RU")} {best.currency}</div>}
                <div style={{ display: "grid", gap: 7 }}>
                  {offers.map((offer: any) => (
                    <div key={offer.id} className="search-offer">
                      <div><b>{offer.store.name}</b>{offer.location && <div style={{ color: "#666", fontSize: 13 }}>{offer.location.city}, {offer.location.address}</div>}</div>
                      <div style={{ color: offer.stockStatus === "OUT_OF_STOCK" ? "#888" : "#333", fontSize: 14 }}>{stockLabel(offer.stockStatus, offer.quantity)}</div>
                      <div><div style={{ textAlign: "right" }}>{offer.oldPrice && <div style={{ color: "#999", fontSize: 13, textDecoration: "line-through" }}>{Number(offer.oldPrice).toLocaleString("ru-RU")} {offer.currency}</div>}<b>{Number(offer.price).toLocaleString("ru-RU")} {offer.currency}</b></div></div>
                      <a href={offer.externalUrl} target="_blank" rel="noreferrer" className="search-offer__cta touch-target">В магазин ↗</a>
                    </div>
                  ))}
                </div>
                <a href={`/product/${product.slug}`} style={{ display: "inline-block", marginTop: 14, color: "#111", fontWeight: 800 }}>Открыть карточку и сравнить →</a>
              </div>
            </article>
          );
        })}
        {result.products.length === 0 && <p>Ничего не найдено. Попробуйте iPhone, Coca-Cola, Bosch или Samsung.</p>}
      </div>
    </main>
  );
}
