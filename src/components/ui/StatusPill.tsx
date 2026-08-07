const STYLES: Record<string, string> = {
  ACTIVE: "bg-success-tint text-success",
  NOT_ON_LINE: "bg-row-divider text-muted",
  ON_ORDER: "bg-primary-tint text-primary",
  REPAIR: "bg-warning-tint text-warning",
  RENTED: "bg-danger-tint text-danger",
};

const LABELS: Record<string, string> = {
  ACTIVE: "Линияда",
  NOT_ON_LINE: "Линияда эмас",
  ON_ORDER: "Заказда",
  REPAIR: "Таъмирда",
  RENTED: "Ижарада",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
        STYLES[status] ?? "bg-row-divider text-muted"
      }`}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
