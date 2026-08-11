import { searchCatalog } from "../../lib/catalog-data";

function stockLabel(status: string, quantity?: number | null) {
  const base = status === "IN_STOCK" ? "В наличии" : status === "LOW_STOCK" ? "Мало" : status === "OUT_OF_STOCK" ? "Нет в наличии" : "Наличие уточняется";
  return quantity != null ? `${base} · ${quantity} шт.` : base;
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const { q = "", sort = "price-asc" } = await searchParams;
  const result = await searchCatalog(q, sort);

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 20px 56px", fontFamily: "system-ui" }}>
      <a href="/" style={{ color: "#111", textDecoration: "none" }}>← Главная</a>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
        <div><h1 style={{ fontSize: 38, marginBottom: 6 }}>Поиск: {q || "все товары"}</h1><div style={{ color: "#666" }}>{result.products.length} результатов {result.mode === "demo" ? "· demo data" : ""}</div></div>
      </div>
      <form style={{ display: "flex", gap: 10, margin: "24px 0 30px", flexWrap: "wrap" }}>
        <input name="q" defaultValue={q} placeholder="Что вы ищете?" style={{ flex: "1 1 300px", padding: 15, border: "1px solid #ccc", borderRadius: 12, fontSize: 16 }} />
        <select name="sort" defaultValue={sort} style={{ padding: 14, border: "1px solid #ccc", borderRadius: 12, background: "white" }}>
          <option value="price-asc">Сначала дешевле</option>
          <option value="price-desc">Сначала дороже</option>
        </select>
        <button style={{ padding: "0 22px", border: 0, borderRadius: 12, background: "#111", color: "white", fontWeight: 800 }}>Применить</button>
      </form>

      <div style={{ display: "grid", gap: 20 }}>
        {result.products.map((product: any) => {
          const offers = product.offers;
          const best = offers[0];
          const imageUrl = result.mode === "demo" ? product.imageUrl : (product.imageUrl || best?.imageUrl);
          const category = result.mode === "demo" ? product.categoryName : product.category?.nameRu;
          const brand = result.mode === "demo" ? product.brand : product.brand?.name;
          return (
            <article key={product.id} style={{ border: "1px solid #e5e5e5", borderRadius: 20, padding: 18, display: "grid", gridTemplateColumns: "minmax(150px,220px) 1fr", gap: 22, background: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,.04)" }}>
              <div style={{ minHeight: 190, background: "#f6f6f6", borderRadius: 15, overflow: "hidden" }}>
                {imageUrl && <img src={imageUrl} alt={product.title} style={{ width: "100%", height: "100%", maxHeight: 230, objectFit: result.mode === "demo" ? "cover" : "contain" }} />}
              </div>
              <div>
                <div style={{ color: "#777", fontSize: 14 }}>{category ?? "Без категории"} {brand ? `• ${brand}` : ""}</div>
                <h2 style={{ margin: "7px 0" }}>{product.title}</h2>
                {best && <div style={{ fontSize: 25, fontWeight: 900, marginBottom: 15 }}>от {Number(best.price).toLocaleString("ru-RU")} {best.currency}</div>}
                <div style={{ display: "grid", gap: 7 }}>
                  {offers.map((offer: any) => (
                    <div key={offer.id} style={{ display: "grid", gridTemplateColumns: "minmax(120px,1fr) minmax(135px,auto) auto auto", gap: 14, alignItems: "center", padding: "11px 0", borderTop: "1px solid #eee" }}>
                      <div><b>{offer.store.name}</b>{offer.location && <div style={{ color: "#666", fontSize: 13 }}>{offer.location.city}, {offer.location.address}</div>}</div>
                      <div style={{ color: offer.stockStatus === "OUT_OF_STOCK" ? "#888" : "#333", fontSize: 14 }}>{stockLabel(offer.stockStatus, offer.quantity)}</div>
                      <div style={{ textAlign: "right" }}>{offer.oldPrice && <div style={{ color: "#999", fontSize: 13, textDecoration: "line-through" }}>{Number(offer.oldPrice).toLocaleString("ru-RU")} {offer.currency}</div>}<b>{Number(offer.price).toLocaleString("ru-RU")} {offer.currency}</b></div>
                      <a href={offer.externalUrl} target="_blank" rel="noreferrer" style={{ padding: "10px 14px", background: "#111", color: "#fff", borderRadius: 10, textDecoration: "none", whiteSpace: "nowrap", fontWeight: 750 }}>В магазин ↗</a>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
        {result.products.length === 0 && <p>Ничего не найдено. Попробуйте iPhone, Coca-Cola, Bosch или Samsung.</p>}
      </div>
    </main>
  );
}
