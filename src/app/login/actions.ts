"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/guards";

export interface LoginState {
  error?: string;
}

const schema = z.object({
  email: z.email("メールアドレスの形式が正しくありません"),
  password: z.string().min(1, "パスワードを入力してください"),
});

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容をご確認ください" };
  }

  const user = await signIn(parsed.data.email, parsed.data.password);
  /* Deliberately does not reveal whether the address exists. */
  if (!user) return { error: "メールアドレスまたはパスワードが正しくありません" };

  redirect(homeFor(user.role));
}

export async function logoutAction(): Promise<never> {
  await signOut();
  redirect("/login");
}
