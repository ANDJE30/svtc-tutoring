import { and, count, eq, lt } from 'drizzle-orm';
import { requireRole } from '@/lib/auth';
import { getCurrentYear, getSettings } from '@/lib/settings';
import { logoUrl } from '@/lib/public-settings';
import { db } from '@/db';
import { documents, enrollmentRequests, seances } from '@/db/schema';
import { AdminShell } from '@/components/client/admin-shell';
import { todayISO } from '@/lib/time';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('ADMIN');
  const [s, year] = await Promise.all([getSettings(), getCurrentYear()]);
  const [[docs], [late], [reqs]] = await Promise.all([
    db.select({ n: count() }).from(documents).where(eq(documents.status, 'SOUMIS')),
    db.select({ n: count() }).from(seances).where(and(eq(seances.academicYearId, year.id), eq(seances.status, 'TERMINEE'), eq(seances.validated, false), lt(seances.date, todayISO()))),
    db.select({ n: count() }).from(enrollmentRequests).where(eq(enrollmentRequests.status, 'NOUVELLE')),
  ]);
  const badges: Record<string, number> = {};
  if (Number(docs.n)) badges['/admin/documents'] = Number(docs.n);
  if (Number(late.n)) badges['/admin/seances'] = Number(late.n);
  if (Number(reqs.n)) badges['/admin/demandes'] = Number(reqs.n);
  return (
    <AdminShell user={{ fullName: user.fullName, username: user.username }} centerName={s.identity.name} yearLabel={year.label} badges={badges} logoUrl={logoUrl(s)}>
      {children}
    </AdminShell>
  );
}
