import Link from 'next/link';
import { and, count, countDistinct, desc, eq, gte, sql } from 'drizzle-orm';
import { BarChart3, Eye, Users, Smartphone, Inbox, Globe2 } from 'lucide-react';
import { db } from '@/db';
import { enrollmentRequests, pageViews } from '@/db/schema';
import { addDays, todayISO } from '@/lib/time';
import { dateShort, num, pct } from '@/lib/format';
import { Card, Empty, PageHeader, Progress, Stat, TableWrap } from '@/components/ui';

export const metadata = { title: 'Audience du site' };

const PERIODS = [7, 30, 90] as const;
const SECTIONS: Record<string, string> = { PUBLIC: 'Site public', ADMIN: 'Administration', ENCADREUR: 'Espace encadreurs', PARENT: 'Espace parents' };
const DEVICES: Record<string, string> = { MOBILE: 'Smartphone', TABLETTE: 'Tablette', ORDINATEUR: 'Ordinateur' };
const PAGE_LABELS: Record<string, string> = {
  '/': "Page d'accueil",
  '/connexion': 'Choix de l’espace de connexion',
  '/confidentialite': 'Confidentialité et mentions légales',
  '/admin/connexion': 'Connexion administration',
  '/encadreur/connexion': 'Connexion encadreur',
  '/parent/connexion': 'Connexion parent',
  '/admin': 'Administration — tableau de bord',
  '/encadreur': 'Espace encadreur — accueil',
  '/encadreur/seances/:id': 'Espace encadreur — séance',
  '/parent': 'Espace parents — accueil',
  '/parent/planning': 'Espace parents — planning',
  '/parent/suivi': 'Espace parents — suivi',
  '/parent/messages': 'Espace parents — messages',
  '/parent/paiements': 'Espace parents — paiements',
};

export default async function AudiencePage({ searchParams }: { searchParams: Promise<{ jours?: string }> }) {
  const sp = await searchParams;
  const days = PERIODS.find((p) => String(p) === sp.jours) ?? 30;
  const today = todayISO();
  const from = addDays(today, -(days - 1));
  const inPeriod = gte(pageViews.day, from);

  const [[tot], [pub], perDay, topPages, bySection, byDevice, bySource, [reqs]] = await Promise.all([
    db.select({ views: count(), visitors: countDistinct(pageViews.visitor) }).from(pageViews).where(inPeriod),
    db.select({ views: count(), visitors: countDistinct(pageViews.visitor) }).from(pageViews).where(and(inPeriod, eq(pageViews.section, 'PUBLIC'))),
    db.select({ day: pageViews.day, views: count(), visitors: countDistinct(pageViews.visitor) }).from(pageViews).where(inPeriod).groupBy(pageViews.day).orderBy(pageViews.day),
    db.select({ path: pageViews.path, views: count(), visitors: countDistinct(pageViews.visitor) }).from(pageViews).where(inPeriod).groupBy(pageViews.path).orderBy(desc(count())).limit(12),
    db.select({ k: pageViews.section, views: count() }).from(pageViews).where(inPeriod).groupBy(pageViews.section).orderBy(desc(count())),
    db.select({ k: pageViews.device, views: countDistinct(pageViews.visitor) }).from(pageViews).where(inPeriod).groupBy(pageViews.device).orderBy(desc(countDistinct(pageViews.visitor))),
    db.select({ k: sql<string>`coalesce(${pageViews.source}, 'Accès direct')`, views: countDistinct(pageViews.visitor) }).from(pageViews).where(and(inPeriod, eq(pageViews.section, 'PUBLIC'))).groupBy(sql`1`).orderBy(desc(countDistinct(pageViews.visitor))).limit(8),
    db.select({ n: count() }).from(enrollmentRequests).where(gte(enrollmentRequests.createdAt, new Date(`${from}T00:00:00+01:00`))),
  ]);

  const series = Array.from({ length: days }, (_, i) => {
    const d = addDays(from, i);
    const row = perDay.find((x) => x.day === d);
    return { day: d, views: Number(row?.views ?? 0), visitors: Number(row?.visitors ?? 0) };
  });
  const max = Math.max(1, ...series.map((x) => x.views));
  const totalViews = Number(tot.views);
  const deviceTotal = byDevice.reduce((a, b) => a + Number(b.views), 0) || 1;
  const sectionTotal = bySection.reduce((a, b) => a + Number(b.views), 0) || 1;
  const conversion = Number(pub.visitors) ? Number(reqs.n) / Number(pub.visitors) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Pilotage"
        title="Audience du site"
        subtitle="Mesure d'audience intégrée, sans cookie ni service tiers : chaque visiteur est compté une fois par jour grâce à une empreinte anonyme renouvelée quotidiennement."
        actions={
          <div className="flex gap-1.5" role="group" aria-label="Période">
            {PERIODS.map((p) => (
              <Link key={p} href={`/admin/audience?jours=${p}`} className={`chip ${p === days ? 'chip-on' : ''}`} aria-current={p === days ? 'page' : undefined}>{p} jours</Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Pages vues" value={num(totalViews)} hint={`sur ${days} jours`} icon={<Eye size={20} />} tone="blue" />
        <Stat label="Visiteurs" value={num(Number(tot.visitors))} hint={`dont ${num(Number(pub.visitors))} sur le site public`} icon={<Users size={20} />} tone="navy" />
        <Stat label="Demandes d'inscription" value={num(Number(reqs.n))} hint={<Link href="/admin/demandes" className="underline">Voir les demandes</Link>} icon={<Inbox size={20} />} tone="gold" />
        <Stat label="Taux de conversion" value={pct(conversion === null ? null : conversion * 100, 1)} hint="demandes / visiteurs publics" icon={<BarChart3 size={20} />} tone="green" />
      </div>

      <Card title="Fréquentation quotidienne" subtitle="Pages vues par jour (survolez une barre pour le détail)">
        {totalViews === 0 ? (
          <Empty icon={<BarChart3 />} title="Pas encore de visite enregistrée" text="Les visites sont enregistrées automatiquement dès la mise en ligne. Les robots et les navigateurs qui demandent « ne pas suivre » sont exclus." />
        ) : (
          <div>
            <div className="flex h-44 items-end gap-[3px]" role="img" aria-label={`Histogramme des pages vues sur ${days} jours, maximum ${max} par jour`}>
              {series.map((x) => (
                <div key={x.day} className="group relative flex h-full flex-1 items-end" title={`${dateShort(x.day)} : ${x.views} page(s) vue(s), ${x.visitors} visiteur(s)`}>
                  <div className="w-full rounded-t bg-gradient-to-t from-royal-700 to-royal-400 transition group-hover:from-gold-600 group-hover:to-gold-400" style={{ height: `${Math.max(x.views ? 3 : 0, (x.views / max) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-500"><span>{dateShort(from)}</span><span>{dateShort(today)}</span></div>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Pages les plus consultées" pad={false}>
          {topPages.length === 0 ? <p className="card-pad text-sm text-slate-500">Aucune donnée.</p> : (
            <TableWrap>
              <table className="tbl">
                <thead><tr><th>Page</th><th className="text-right">Vues</th><th className="text-right">Visiteurs</th></tr></thead>
                <tbody>
                  {topPages.map((p) => (
                    <tr key={p.path}>
                      <td><p className="text-sm font-medium text-navy-950">{PAGE_LABELS[p.path] ?? p.path}</p>{PAGE_LABELS[p.path] && <p className="text-xs text-slate-500">{p.path}</p>}</td>
                      <td className="text-right">{num(Number(p.views))}</td>
                      <td className="text-right">{num(Number(p.visitors))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
        <div className="space-y-6">
          <Card title="Appareils utilisés">
            <ul className="space-y-3">
              {byDevice.map((d) => (
                <li key={d.k}>
                  <div className="mb-1 flex justify-between text-sm"><span className="flex items-center gap-1.5"><Smartphone size={15} className="text-slate-400" aria-hidden /> {DEVICES[d.k] ?? d.k}</span><span className="font-medium">{pct((Number(d.views) / deviceTotal) * 100)}</span></div>
                  <Progress value={(Number(d.views) / deviceTotal) * 100} />
                </li>
              ))}
              {byDevice.length === 0 && <li className="text-sm text-slate-500">Aucune donnée.</li>}
            </ul>
          </Card>
          <Card title="Espaces consultés">
            <ul className="space-y-3">
              {bySection.map((d) => (
                <li key={d.k}>
                  <div className="mb-1 flex justify-between text-sm"><span>{SECTIONS[d.k] ?? d.k}</span><span className="font-medium">{num(Number(d.views))}</span></div>
                  <Progress value={(Number(d.views) / sectionTotal) * 100} tone="gold" />
                </li>
              ))}
              {bySection.length === 0 && <li className="text-sm text-slate-500">Aucune donnée.</li>}
            </ul>
          </Card>
          <Card title="Provenance des visiteurs" subtitle="Site public : sites ou réseaux sociaux d'où arrivent les visiteurs">
            <ul className="divide-y divide-navy-50">
              {bySource.map((d) => (
                <li key={d.k} className="flex items-center justify-between py-2 text-sm"><span className="flex items-center gap-1.5"><Globe2 size={15} className="text-slate-400" aria-hidden /> {d.k}</span><span className="font-medium">{num(Number(d.views))}</span></li>
              ))}
              {bySource.length === 0 && <li className="py-2 text-sm text-slate-500">Aucune donnée.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
