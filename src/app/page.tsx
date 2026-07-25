import { redirect } from "next/navigation";
import { auth } from "@/auth";

const ROLE_HOME: Record<string, string> = {
  OWNER: "/owner",
  ADMIN: "/admin/panel",
  ACCOUNTANT: "/accountant/payroll",
  DISPATCHER: "/dispatcher/point",
  MECHANIC: "/mechanic/fuel",
  DRIVER: "/driver",
};

export default async function Home() {
  const session = await auth();
  if (!session) redirect("/login");
  redirect(ROLE_HOME[session.user.role] ?? "/coming-soon");
}
