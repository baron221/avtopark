import Link from "next/link";

function buildHref(basePath: string, params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  search.set("page", String(page));
  return `${basePath}?${search.toString()}`;
}

export function Pagination({
  page,
  totalPages,
  basePath,
  params = {},
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <div className="flex items-center justify-between px-6 py-3.5 border-t border-row-divider">
      <Link
        href={buildHref(basePath, params, Math.max(1, page - 1))}
        aria-disabled={prevDisabled}
        className={`text-[13px] font-extrabold px-3.5 py-1.5 rounded-lg ${
          prevDisabled ? "text-muted-2 pointer-events-none opacity-50" : "text-primary bg-primary-tint"
        }`}
      >
        ← Олдинги
      </Link>
      <span className="text-[13px] font-bold text-muted-2">
        Саҳифа {page} / {totalPages}
      </span>
      <Link
        href={buildHref(basePath, params, Math.min(totalPages, page + 1))}
        aria-disabled={nextDisabled}
        className={`text-[13px] font-extrabold px-3.5 py-1.5 rounded-lg ${
          nextDisabled ? "text-muted-2 pointer-events-none opacity-50" : "text-primary bg-primary-tint"
        }`}
      >
        Кейинги →
      </Link>
    </div>
  );
}
