import type { Point, Role } from "@prisma/client";

const ROLE_STYLES: Record<Role, { bg: string; color: string }> = {
  ADMIN: { bg: "#1E1F2B", color: "#fff" },
  OWNER: { bg: "#EEF0F8", color: "#4F46E5" },
  ACCOUNTANT: { bg: "#EEF0F8", color: "#4F46E5" },
  DISPATCHER: { bg: "#FFF3E0", color: "#B26A00" },
  MECHANIC: { bg: "#E4F5EC", color: "#1B9E6B" },
  DRIVER: { bg: "#F0F1F7", color: "#6B6D82" },
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Админ",
  OWNER: "Эгаси",
  ACCOUNTANT: "Бухгалтер",
  DISPATCHER: "Диспетчер",
  MECHANIC: "Механик",
  DRIVER: "Ҳайдовчи",
};

const POINT_LABELS: Record<Point, string> = {
  FARGONA: "Фарғона",
  QUVA: "Қува",
};

export function RoleBadge({ role, point }: { role: Role; point?: Point | null }) {
  const style = ROLE_STYLES[role];
  const label = point ? `${ROLE_LABELS[role]} · ${POINT_LABELS[point]}` : ROLE_LABELS[role];

  return (
    <span
      className="text-xs font-extrabold px-3 py-1 rounded-full whitespace-nowrap"
      style={{ background: style.bg, color: style.color }}
    >
      {label}
    </span>
  );
}
