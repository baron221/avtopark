import { quickLoginAction } from "./actions";

const TEST_PASSWORD = "parol123";

const ACCOUNTS = [
  { label: "Egasi", phone: "+998901111101" },
  { label: "Admin", phone: "+998901111102" },
  { label: "Buxgalter", phone: "+998901111103" },
  { label: "Dispetcher · Farg'ona", phone: "+998901111104" },
  { label: "Dispetcher · Quva", phone: "+998901111107" },
  { label: "Mexanik", phone: "+998901111105" },
  { label: "Haydovchi", phone: "+998901111106" },
];

// Only for local development — never rendered against the deployed/production
// build, since these are the seeded test accounts' real credentials.
export function QuickLoginButtons() {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="flex flex-col gap-2.5 pt-3 mt-1 border-t border-border">
      <div className="text-xs text-muted-2 font-bold text-center">Test uchun tezkor kirish (faqat lokal)</div>
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
