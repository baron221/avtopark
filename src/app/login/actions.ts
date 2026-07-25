"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";
import { ACCOUNT_LOCKED_CODE, LOCKOUT_MINUTES } from "@/auth";

export type LoginState = { error: string };

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      phone: formData.get("phone"),
      password: formData.get("password"),
      redirectTo: "/",
    });
    return { error: "" };
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code === ACCOUNT_LOCKED_CODE) {
      return {
        error: `Juda ko'p noto'g'ri urinish. Hisobingiz ${LOCKOUT_MINUTES} daqiqaga vaqtincha bloklandi.`,
      };
    }
    if (error instanceof AuthError) {
      return { error: "Telefon raqam yoki parol noto'g'ri" };
    }
    throw error;
  }
}
