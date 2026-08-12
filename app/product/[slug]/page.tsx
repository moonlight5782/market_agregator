import { notFound } from "next/navigation";
import { getProductBySlug } from "../../../lib/product-data";

function stockLabel(status: string, quantity?: number | null) {
  if (status === "OUT_OF_STOCK" || quantity === 0) return "Нет в наличии";
  if (status === "PREORDER") return "Предзаказ";
  if (quantity != null && quantity > 0 && quantity <= 10) return `В наличии · ${quantity} шт.`;
  if (status === "IN_STOCK" || status === "LOW_STOCK" || (quantity != null && quantity > 10)) return "В наличии";
  return "Наличие уточняется";
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getProductBySlug(slug);
  if (!result) notFound();

  const product: any = result.product;
  const offers = [...product.offers].sort((a: any, b: any) => Number(a.price) - Number(b.price));
  const best = offers[0];
  const imageUrl = product.imageUrl || best?.imageUrl;
  const categoryName = result.mode === "demo" ? product.categoryName : product.category?.nameRu;
  const brandName = result.mode === "demo" ? product.brand : product.brand?.name;

  return (
    <main className="page-shell">
      <a href="/" style={{ color: "#111", textDecoration: "none" }}>← Главная</a>
      <div className="product-hero">
        <div className="product-hero__image">
          {imageUrl ? <img src={imageUrl} alt={product.title} style={{ objectFit: result.mode === "demo" ? "cover" : "contain" }} /> : <span style={{ color: "#888" }}>Нет изображения</span>}
        </div>
        <section>
          <div style={{ color: "#777", fontSize: 14 }}>{categoryName ?? "Без категории"}{brandName ? ` · ${brandName}` : ""}</div>
          <h1 className="product-title">{product.title}</h1>
          {best && (
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 18, padding: 20, marginBottom: 22 }}>
              <div style={{ color: "#666", fontSize: 14 }}>Лучшая цена</div>
              <div style={{ fontSize: "clamp(28px,8vw,34px)", fontWeight: 900, marginTop: 3 }}>от {Number(best.price).toLocaleString("ru-RU")} {best.currency}</div>
              <div style={{ color: "#666", marginTop: 7 }}>{offers.length} предлож. · {offers.filter((o: any) => o.stockStatus === "IN_STOCK" || o.stockStatus === "LOW_STOCK").length} в наличии</div>
            </div>
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
        <p style={{ marginTop: 0, color: "#666" }}>Цена, наличие и ссылка берутся из конкретного магазина.</p>
        <div className="offer-list">
          {offers.map((offer: any) => (
            <div key={offer.id} className="offer-row">
              <div><b style={{ fontSize: 17 }}>{offer.store.name}</b>{offer.location && <div style={{ color: "#777", fontSize: 13, marginTop: 3 }}>{offer.location.city}{offer.location.address ? ` · ${offer.location.address}` : ""}</div>}</div>
              <div>{offer.oldPrice && Number(offer.oldPrice) > Number(offer.price) && <div style={{ color: "#999", textDecoration: "line-through", fontSize: 13 }}>{Number(offer.oldPrice).toLocaleString("ru-RU")} {offer.currency}</div>}<div className="offer-row__price">{Number(offer.price).toLocaleString("ru-RU")} {offer.currency}</div></div>
              <div style={{ color: offer.stockStatus === "OUT_OF_STOCK" ? "#888" : "#333" }}>{stockLabel(offer.stockStatus, offer.quantity)}</div>
              <a href={offer.externalUrl} target="_blank" rel="noreferrer" className="offer-row__cta touch-target">В магазин ↗</a>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
