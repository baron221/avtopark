export type AccessLevel = "YES" | "OWN" | "NO";

export type AccessRow = {
  module: string;
  admin: AccessLevel;
  owner: AccessLevel;
  acc: AccessLevel;
  disp: AccessLevel;
  mech: AccessLevel;
  drv: AccessLevel;
};

// Source of truth: design_handoff_avtopark/Avtopark Foyda.dc.html, screen "3a Kirish huquqlari".
export const ACCESS_MATRIX: AccessRow[] = [
  { module: "Foyda paneli (butun park)", admin: "YES", owner: "YES", acc: "YES", disp: "NO", mech: "NO", drv: "NO" },
  { module: "Foydalanuvchilar / rollar", admin: "YES", owner: "NO", acc: "NO", disp: "NO", mech: "NO", drv: "NO" },
  { module: "Vedomost · avans · jarima · obed", admin: "YES", owner: "YES", acc: "YES", disp: "OWN", mech: "OWN", drv: "OWN" },
  { module: "Pul qabul qilish (punkt)", admin: "YES", owner: "NO", acc: "NO", disp: "OWN", mech: "NO", drv: "NO" },
  { module: "Kirim-chiqim jurnali", admin: "YES", owner: "YES", acc: "YES", disp: "OWN", mech: "NO", drv: "OWN" },
  { module: "Mashinalar (qo'shish, ta'mir)", admin: "YES", owner: "NO", acc: "NO", disp: "NO", mech: "YES", drv: "NO" },
  { module: "Yoqilg'i · zapravka to'lovlari", admin: "YES", owner: "YES", acc: "YES", disp: "NO", mech: "YES", drv: "OWN" },
  { module: "Smenalar", admin: "YES", owner: "YES", acc: "NO", disp: "OWN", mech: "NO", drv: "OWN" },
  { module: "Reys / zakaz kiritish", admin: "YES", owner: "NO", acc: "NO", disp: "OWN", mech: "NO", drv: "OWN" },
];

export const ACCESS_ROLE_COLUMNS = [
  { key: "admin", label: "Admin" },
  { key: "owner", label: "Egasi" },
  { key: "acc", label: "Buxgalter" },
  { key: "disp", label: "Dispetcher" },
  { key: "mech", label: "Mexanik" },
  { key: "drv", label: "Haydovchi" },
] as const;
