import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { locations } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui";
import { StartShiftForm } from "./form";

export default async function NewShiftPage() {
  await requireRole("sales", "admin");
  const db = await getDb();

  const rows = await db
    .select({
      id: locations.id,
      venueName: locations.venueName,
      prefecture: locations.prefecture,
      city: locations.city,
      venueType: locations.venueType,
    })
    .from(locations)
    .where(eq(locations.active, true))
    .orderBy(locations.prefecture, locations.city);

  return (
    <>
      <PageHeader
        title="営業を開始する"
        description="場所とシフト時間を登録すると、この営業専用のQRコードが発行されます。"
      />
      <StartShiftForm locations={rows} />
    </>
  );
}
