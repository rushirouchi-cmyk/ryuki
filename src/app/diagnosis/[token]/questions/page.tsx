import { redirect } from "next/navigation";
import { loadCandidate, loadLatestDiagnosis, loadQuestionOptions } from "../data";
import { Wizard } from "./wizard";

export default async function QuestionsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { candidate } = await loadCandidate(token);

  const existing = await loadLatestDiagnosis(candidate.id);
  if (existing) redirect(`/diagnosis/${token}/result`);

  const options = await loadQuestionOptions();
  return <Wizard token={token} options={options} />;
}
