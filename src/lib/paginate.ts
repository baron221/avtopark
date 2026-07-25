export const DEFAULT_PAGE_SIZE = 20;

export function parsePage(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function paginationSkip(page: number, pageSize = DEFAULT_PAGE_SIZE): number {
  return (page - 1) * pageSize;
}

export function totalPages(totalCount: number, pageSize = DEFAULT_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(totalCount / pageSize));
}
