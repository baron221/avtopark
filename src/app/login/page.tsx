import { Card } from "@/components/ui/Card";
import { LoginForm } from "./LoginForm";
import { QuickLoginButtons } from "./QuickLoginButtons";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-[420px] p-10 flex flex-col gap-[18px]">
        <div className="flex flex-col items-center gap-2.5">
          <div className="w-[52px] h-[52px] rounded-2xl bg-primary text-white flex items-center justify-center font-heading font-bold text-[22px]">
            FQ
          </div>
          <div className="font-heading font-bold text-xl text-heading">Farg&apos;ona–Quva Avtopark</div>
          <div className="text-[13px] text-muted-2 font-semibold">Telefon raqamingiz bilan kiring</div>
        </div>
        <LoginForm />
        <QuickLoginButtons />
      </Card>
    </div>
  );
}
