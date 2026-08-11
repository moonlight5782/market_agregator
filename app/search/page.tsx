import { prisma } from "../../lib/prisma";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const { q = "", sort = "price-asc" } = await searchParams;

  const products = q
    ? await prisma.product.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { normalizedTitle: { contains: q.toLowerCase(), mode: "insensitive" } },
            { brand: { name: { contains: q, mode: "insensitive" } } }
          ]
        },
        include: {
          category: true,
          brand: true,
          offers: {
            include: { store: true, location: true },
            orderBy: sort === "price-desc" ? { price: "desc" } : { price: "asc" }
          }
        },
        take: 100
      })
    : [];

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 20px", fontFamily: "system-ui" }}>
      <a href="/">← Главная</a>
      <h1>Поиск: {q || "—"}</h1>
      <form style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <input name="q" defaultValue={q} style={{ flex: 1, padding: 14, border: "1px solid #ccc", borderRadius: 10 }} />
        <select name="sort" defaultValue={sort} style={{ padding: 14, borderRadius: 10 }}>
          <option value="price-asc">Сначала дешевле</option>
          <option value="price-desc">Сначала дороже</option>
        </select>
        <button style={{ padding: "0 22px" }}>Применить</button>
      </form>

      <div style={{ display: "grid", gap: 18 }}>
        {products.map((product) => {
          const offers = product.offers;
          const best = offers[0];
          return (
            <article key={product.id} style={{ border: "1px solid #e5e5e5", borderRadius: 16, padding: 20 }}>
              <div style={{ color: "#666", fontSize: 14 }}>
                {product.category?.nameRu ?? "Без категории"} {product.brand ? `• ${product.brand.name}` : ""}
              </div>
              <h2 style={{ margin: "8px 0" }}>{product.title}</h2>
              {best && <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>от {best.price.toString()} {best.currency}</div>}
              <div style={{ display: "grid", gap: 8 }}>
                {offers.map((offer) => (
                  <div key={offer.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 16, alignItems: "center", padding: "10px 0", borderTop: "1px solid #eee" }}>
                    <div>
                      <b>{offer.store.name}</b>
                      {offer.location && <div style={{ color: "#666", fontSize: 13 }}>{offer.location.city}, {offer.location.address}</div>}
                    </div>
                    <div>{offer.stockStatus === "IN_STOCK" ? "В наличии" : offer.stockStatus === "OUT_OF_STOCK" ? "Нет в наличии" : "Наличие уточняется"}{offer.quantity != null ? ` • ${offer.quantity} шт.` : ""}</div>
                    <b>{offer.price.toString()} {offer.currency}</b>
                    <a href={offer.externalUrl} target="_blank" rel="noreferrer" style={{ padding: "10px 14px", background: "#111", color: "#fff", borderRadius: 9 }}>В магазин ↗</a>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
        {q && products.length === 0 && <p>Ничего не найдено.</p>}
      </div>
    </main>
  );
}
