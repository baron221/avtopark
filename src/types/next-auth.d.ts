import type { Point, Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: Role;
    point: Point | null;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      point: Point | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    point: Point | null;
  }
}
