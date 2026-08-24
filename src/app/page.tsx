import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/guards";

export default async function RootPage() {
  const user = await getSessionUser();
  redirect(user ? homeFor(user.role) : "/login");
}
