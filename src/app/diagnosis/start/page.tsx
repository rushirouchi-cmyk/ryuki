import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { Questionnaire } from './questionnaire';

export const dynamic = 'force-dynamic';

export default async function DiagnosisStartPage() {
  const db = getDb();
  const [occupations, skills, certifications] = await Promise.all([
    db.query.occupations.findMany({ where: eq(schema.occupations.active, true) }),
    db.query.skills.findMany(),
    db.query.certifications.findMany(),
  ]);

  return (
    <main className="mx-auto max-w-md">
      <Questionnaire
        occupations={occupations.map((o) => ({ id: o.id, name: o.name, category: o.category }))}
        skills={skills.map((s) => ({ id: s.id, name: s.name, category: s.category }))}
        certifications={certifications.map((c) => ({ id: c.id, name: c.name, category: c.category }))}
      />
    </main>
  );
}
