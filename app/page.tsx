import { prisma } from "../lib/prisma";

export default async function Home() {
  const [categories, storeCount, productCount, offerCount, latestProducts] = await Promise.all([
    prisma.category.findMany({ where: { parentId: null }, orderBy: { nameRu: "asc" } }),
    prisma.store.count({ where: { active: true } }),
    prisma.product.count(),
    prisma.offer.count(),
    prisma.product.findMany({
      include: { category: true, brand: true, offers: { include: { store: true }, orderBy: { price: "asc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
      take: 8
    })
  ]);

  return (
    <main style={{maxWidth: 1180, margin: "0 auto", padding: "32px 20px", fontFamily: "system-ui"}}>
      <header style={{marginBottom: 42}}>
        <div style={{fontSize: 14, fontWeight: 700}}>MOLDOVA COMMERCE</div>
        <h1 style={{fontSize: 48, maxWidth: 800, marginBottom: 12}}>Все товары Молдовы в одном поиске</h1>
        <p style={{color: "#666", fontSize: 18}}>Сравнивайте цену, наличие и предложения магазинов.</p>
        <form action="/search" style={{display: "flex", gap: 10, marginTop: 24}}>
          <input name="q" placeholder="Что вы ищете?" style={{flex: 1, padding: 18, border: "1px solid #ccc", borderRadius: 12, fontSize: 17}} />
          <button style={{padding: "0 28px", border: 0, borderRadius: 12, background: "#111", color: "white", fontWeight: 700}}>Найти</button>
        </form>
        <div style={{display: "flex", gap: 20, marginTop: 18, color: "#555", flexWrap: "wrap"}}>
          <span><b>{storeCount}</b> магазинов</span><span><b>{productCount}</b> товаров</span><span><b>{offerCount}</b> предложений</span>
        </div>
      </header>

      <section>
        <h2>Категории</h2>
        <div style={{display: "flex", flexWrap: "wrap", gap: 10}}>
          {categories.map(c => <a href={`/category/${c.slug}`} key={c.id} style={{padding: "11px 15px", background: "#f3f3f3", borderRadius: 999, color: "inherit", textDecoration: "none"}}>{c.nameRu}</a>)}
        </div>
      </section>

      <section style={{marginTop: 44}}>
        <h2>Последние товары</h2>
        <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 16}}>
          {latestProducts.map(product => {
            const best = product.offers[0];
            return <article key={product.id} style={{border: "1px solid #e5e5e5", borderRadius: 16, padding: 18}}>
              <div style={{fontSize: 13, color: "#666"}}>{product.category?.nameRu ?? "Без категории"}</div>
              <h3>{product.title}</h3>
              {best && <><div style={{fontWeight: 800, fontSize: 20}}>{best.price.toString()} {best.currency}</div><div style={{color: "#666", marginTop: 5}}>{best.store.name}</div></>}
            </article>;
          })}
        </div>
      </section>
    </main>
  );
}
