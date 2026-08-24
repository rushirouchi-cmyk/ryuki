import { redirect } from "next/navigation";
import { loadCandidate, loadContact, loadLatestDiagnosis } from "../data";
import { RegisterForm } from "./form";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { candidate } = await loadCandidate(token);

  const result = await loadLatestDiagnosis(candidate.id);
  if (!result) redirect(`/diagnosis/${token}`);

  const contact = await loadContact(candidate.id);
  if (contact) redirect(`/diagnosis/${token}/booking`);

  return <RegisterForm token={token} />;
}
