export default function SearchLoading() {
  return (
    <main className="page-shell loading-page" aria-busy="true" aria-label="Loading">
      <div className="skeleton skeleton--title" />
      <div className="skeleton skeleton--control" />
      <div className="skeleton-card"><div className="skeleton skeleton--image" /><div><div className="skeleton skeleton--line" /><div className="skeleton skeleton--line skeleton--short" /><div className="skeleton skeleton--control" /></div></div>
      <div className="skeleton-card"><div className="skeleton skeleton--image" /><div><div className="skeleton skeleton--line" /><div className="skeleton skeleton--line skeleton--short" /></div></div>
    </main>
  );
}
