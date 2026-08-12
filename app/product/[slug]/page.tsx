import { notFound } from "next/navigation";
import { getProductBySlug } from "../../../lib/product-data";

function stockLabel(status: string, quantity?: number | null) {
  if (status === "OUT_OF_STOCK" || quantity === 0) return "Нет в наличии";
  if (status === "PREORDER") return "Предзаказ";
  if (quantity != null && quantity > 0 && quantity <= 10) return `В наличии · ${quantity} шт.`;
  if (status === "IN_STOCK" || status === "LOW_STOCK" || (quantity != null && quantity > 10)) return "В наличии";
  return "Наличие уточняется";
}

function isAvailable(status: string) {
  return status === "IN_STOCK" || status === "LOW_STOCK" || status === "PREORDER";
}

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ city?: string }> }) {
  const [{ slug }, { city = "" }] = await Promise.all([params, searchParams]);
  const result = await getProductBySlug(slug, city);
  if (!result) notFound();

  const product: any = result.product;
  const offers = [...product.offers].sort((a: any, b: any) => Number(a.price) - Number(b.price));
  const best = offers[0];
  const imageUrl = product.imageUrl || best?.imageUrl;
  const categoryName = result.mode === "demo" ? product.categoryName : product.category?.nameRu;
  const brandName = result.mode === "demo" ? product.brand : product.brand?.name;
  const availableOffers = offers.filter((offer: any) => {
    if (offer.availabilities?.length) return offer.availabilities.some((item: any) => isAvailable(item.stockStatus));
    if (city && !offer.location) return false;
    return isAvailable(offer.stockStatus);
  });

  return (
    <main className="page-shell">
      <a href={city ? `/search?city=${encodeURIComponent(city)}` : "/"} style={{ color: "#111", textDecoration: "none" }}>← {city ? `Товары в ${city}` : "Главная"}</a>
      <div className="product-hero">
        <div className="product-hero__image">
          {imageUrl ? <img src={imageUrl} alt={product.title} style={{ objectFit: result.mode === "demo" ? "cover" : "contain" }} /> : <span style={{ color: "#888" }}>Нет изображения</span>}
        </div>
        <section>
          <div style={{ color: "#777", fontSize: 14 }}>{categoryName ?? "Без категории"}{brandName ? ` · ${brandName}` : ""}{city ? ` · ${city}` : ""}</div>
          <h1 className="product-title">{product.title}</h1>
          {best ? (
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 18, padding: 20, marginBottom: 22 }}>
              <div style={{ color: "#666", fontSize: 14 }}>Лучшая цена{city ? ` в ${city}` : ""}</div>
              <div style={{ fontSize: "clamp(28px,8vw,34px)", fontWeight: 900, marginTop: 3 }}>от {Number(best.price).toLocaleString("ru-RU")} {best.currency}</div>
              <div style={{ color: "#666", marginTop: 7 }}>{offers.length} предлож. · {availableOffers.length} с подтверждённым наличием</div>
            </div>
          ) : (
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 18, padding: 20, marginBottom: 22, color: "#666" }}>Нет актуальных предложений{city ? ` в ${city}` : ""}.</div>
          )}
          {result.mode === "db" && product.description && <p style={{ color: "#555", lineHeight: 1.6 }}>{product.description}</p>}
          {result.mode === "db" && product.attributes && Object.keys(product.attributes).length > 0 && (
            <div style={{ marginTop: 22 }}>
              <h2 style={{ fontSize: 20 }}>Характеристики</h2>
              <div className="spec-grid">
                {Object.entries(product.attributes).slice(0, 12).map(([key, value]) => <div key={key} style={{ padding: "10px 12px", background: "#f6f6f6", borderRadius: 10, overflowWrap: "anywhere" }}><span style={{ color: "#777" }}>{key}: </span><b>{String(value)}</b></div>)}
              </div>
            </div>
          )}
        </section>
      </div>

      <section style={{ marginTop: 44 }}>
        <h2 style={{ fontSize: 28, marginBottom: 6 }}>Предложения магазинов</h2>
        <p style={{ marginTop: 0, color: "#666" }}>Цена относится к предложению магазина, наличие — к конкретному филиалу, когда магазин его раскрывает.</p>
        <div className="offer-list">
          {offers.map((offer: any) => {
            const branches = offer.availabilities ?? [];
            const selectedBranch = branches[0];
            const cityStockUnverified = Boolean(city && !selectedBranch && !offer.location);
            const status = cityStockUnverified ? "UNKNOWN" : (selectedBranch?.stockStatus ?? offer.stockStatus);
            const quantity = cityStockUnverified ? null : (selectedBranch?.quantity ?? offer.quantity);
            const branchAvailableCount = branches.filter((item: any) => isAvailable(item.stockStatus)).length;
            return (
              <div key={offer.id} className="offer-row">
                <div>
                  <b style={{ fontSize: 17 }}>{offer.store.name}</b>
                  {selectedBranch?.location && <div style={{ color: "#777", fontSize: 13, marginTop: 3 }}>{selectedBranch.location.city}{selectedBranch.location.address ? ` · ${selectedBranch.location.address}` : ""}</div>}
                  {!city && branches.length > 1 && <div style={{ color: "#777", fontSize: 13, marginTop: 3 }}>Доступно в {branchAvailableCount} из {branches.length} проверенных филиалов</div>}
                  {!selectedBranch && offer.location && <div style={{ color: "#777", fontSize: 13, marginTop: 3 }}>{offer.location.city}{offer.location.address ? ` · ${offer.location.address}` : ""}</div>}
                  {cityStockUnverified && <div style={{ color: "#777", fontSize: 13, marginTop: 3 }}>{city} · магазин присутствует, остаток филиала не подтверждён</div>}
                </div>
                <div>{offer.oldPrice && Number(offer.oldPrice) > Number(offer.price) && <div style={{ color: "#999", textDecoration: "line-through", fontSize: 13 }}>{Number(offer.oldPrice).toLocaleString("ru-RU")} {offer.currency}</div>}<div className="offer-row__price">{Number(offer.price).toLocaleString("ru-RU")} {offer.currency}</div></div>
                <div style={{ color: status === "OUT_OF_STOCK" ? "#888" : "#333" }}>{stockLabel(status, quantity)}</div>
                <a href={offer.externalUrl} target="_blank" rel="noreferrer" className="offer-row__cta touch-target">В магазин ↗</a>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
