const STYLES: Record<string, string> = {
  ACTIVE: "bg-success-tint text-success",
  REPAIR: "bg-warning-tint text-warning",
  RENTED: "bg-primary-tint text-primary",
  SOLD: "bg-row-divider text-muted",
};

const LABELS: Record<string, string> = {
  ACTIVE: "Liniyada",
  REPAIR: "Ta'mirda",
  RENTED: "Ijarada",
  SOLD: "Sotilgan",
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
