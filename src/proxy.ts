import { NextResponse } from "next/server";
import { auth } from "@/auth";

const ROLE_HOME: Record<string, string> = {
  OWNER: "/owner",
  ADMIN: "/admin/panel",
  ACCOUNTANT: "/accountant/payroll",
  DISPATCHER: "/dispatcher/point",
  MECHANIC: "/mechanic/fuel",
  DRIVER: "/driver",
};

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;
  const isLoginPage = nextUrl.pathname === "/login";

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (isLoggedIn && isLoginPage) {
    const home = (role && ROLE_HOME[role]) || "/coming-soon";
    return NextResponse.redirect(new URL(home, nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
