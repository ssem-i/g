export default function Loading() {
  return (
    <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true" aria-label="불러오는 중">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-video animate-pulse rounded-xl bg-surface-2" />
      ))}
    </div>
  );
}
