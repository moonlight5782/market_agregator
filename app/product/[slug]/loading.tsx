export default function ProductLoading() {
  return (
    <main className="page-shell loading-page" aria-busy="true" aria-label="Loading">
      <div className="product-hero">
        <div className="skeleton skeleton--product-image" />
        <div><div className="skeleton skeleton--line skeleton--short" /><div className="skeleton skeleton--title" /><div className="skeleton skeleton--control" /></div>
      </div>
    </main>
  );
}
