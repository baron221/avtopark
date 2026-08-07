import { quickLoginAction } from "./actions";

const TEST_PASSWORD = "Avtopark2026";

const ACCOUNTS = [
  { label: "Эгаси", phone: "+998956575757" },
  { label: "Админ", phone: "+998956622222" },
  { label: "Бухгалтер", phone: "+998991387090" },
  { label: "Диспетчер · Фарғона", phone: "+998911242295" },
  { label: "Диспетчер · Қува", phone: "+998911233717" },
  { label: "Механик", phone: "+998901111105" },
  { label: "Ҳайдовчи", phone: "+998900000006" },
];

// TEMPORARY: also rendered in production for now, per explicit request, so it
// can be tested on the live deployed site. This exposes one-click login to
// every seeded test account (including Owner/Admin) to anyone who visits
// /login — remove the moment testing is done by restoring the guard:
//   if (process.env.NODE_ENV === "production") return null;
export function QuickLoginButtons() {
  return (
    <div className="flex flex-col gap-2.5 pt-3 mt-1 border-t border-border">
      <div className="text-xs text-muted-2 font-bold text-center">Тест учун тезкор кириш (фақат локал)</div>
      <div className="grid grid-cols-2 gap-2">
        {ACCOUNTS.map((acc) => (
          <form key={acc.phone} action={quickLoginAction}>
            <input type="hidden" name="phone" value={acc.phone} />
            <input type="hidden" name="password" value={TEST_PASSWORD} />
            <button
              type="submit"
              className="w-full bg-page border border-border rounded-lg py-2 px-2 text-xs font-extrabold text-heading hover:border-primary hover:text-primary"
            >
              {acc.label}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
