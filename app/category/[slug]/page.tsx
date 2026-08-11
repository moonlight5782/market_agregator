import { prisma } from "../../../lib/prisma";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      children: true,
      products: {
        include: {
          brand: true,
          offers: { include: { store: true }, orderBy: { price: "asc" } }
        },
        orderBy: { title: "asc" },
        take: 200
      }
    }
  });

  if (!category) return <main style={{padding: 30}}>Категория не найдена.</main>;

  return (
    <main style={{maxWidth: 1180, margin: "0 auto", padding: "32px 20px", fontFamily: "system-ui"}}>
      <a href="/">← Главная</a>
      <h1>{category.nameRu}</h1>
      {category.children.length > 0 && (
        <div style={{display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 28}}>
          {category.children.map((child) => <a key={child.id} href={`/category/${child.slug}`} style={{padding: "10px 14px", background: "#f3f3f3", borderRadius: 999}}>{child.nameRu}</a>)}
        </div>
      )}
      <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16}}>
        {category.products.map((product) => {
          const best = product.offers[0];
          return <article key={product.id} style={{border: "1px solid #e5e5e5", borderRadius: 16, padding: 18}}>
            <div style={{fontSize: 13,color: "#666"}}>{product.brand?.name ?? ""}</div>
            <h3>{product.title}</h3>
            {best ? <><div style={{fontSize: 20,fontWeight: 800}}>от {best.price.toString()} {best.currency}</div><div style={{marginTop: 8,color: "#666"}}>{product.offers.length} предлож.</div></> : <div>Нет активных предложений</div>}
          </article>;
        })}
      </div>
    </main>
  );
}
