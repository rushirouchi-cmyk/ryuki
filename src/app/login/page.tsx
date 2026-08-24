import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/guards";
import { LoginForm } from "./form";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.role));
  return <LoginForm />;
}
