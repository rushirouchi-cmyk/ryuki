import { redirect } from "next/navigation";
import { addDays, setHours, startOfDay } from "date-fns";
import { loadBooking, loadCandidate, loadContact } from "../data";
import { BookingForm } from "./form";

/** Simple rolling slot generator; a real scheduler would come from the CRM. */
function buildSlots(): { value: string; label: string }[] {
  const base = startOfDay(new Date());
  const slots: { value: string; label: string }[] = [];

  for (let dayOffset = 1; dayOffset <= 7; dayOffset += 1) {
    const day = addDays(base, dayOffset);
    for (const hour of [11, 14, 17, 19]) {
      const slot = setHours(day, hour);
      slots.push({
        value: slot.toISOString(),
        label: slot.toLocaleString("ja-JP", {
          month: "numeric",
          day: "numeric",
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    }
  }
  return slots;
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { candidate } = await loadCandidate(token);

  const contact = await loadContact(candidate.id);
  if (!contact) redirect(`/diagnosis/${token}/register`);

  const booking = await loadBooking(candidate.id);
  if (booking) redirect(`/diagnosis/${token}/agents`);

  return <BookingForm token={token} slots={buildSlots()} name={contact.fullName} />;
}
