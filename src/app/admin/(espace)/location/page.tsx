import { FileDown, Building2, CheckCircle2, CalendarPlus, Trash2, Undo2, Lock } from 'lucide-react';
import { computeRentReport, rentSettlement } from '@/lib/payroll';
import { getSettings } from '@/lib/settings';
import { dateFr, dateTimeFr, duration, hours, money, periodLabel } from '@/lib/format';
import { DAYS } from '@/lib/constants';
import { currentPeriod, periodBounds } from '@/lib/time';
import { Badge, Card, PageHeader, Stat, TableWrap, Empty } from '@/components/ui';
import { ActionButton, Modal } from '@/components/client/forms';
import { RentEntryForm } from '@/components/admin/rent-entry-form';
import { payRent, deleteRentLine, restoreRentLine } from '@/app/actions/finance';
import { todayISO } from '@/lib/time';

export const metadata = { title: 'Location des salles' };

const BASIS = { PLANNED: 'durée prévue des séances tenues', ACTUAL: 'durée réelle pointée', WINDOW: 'plage complète de chaque journée de séance' };

export default async function RentPage({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const sp = await searchParams;
  const period = /^\d{4}-\d{2}$/.test(sp.mois ?? '') ? sp.mois! : currentPeriod();
  const { start, end } = periodBounds(period);
  const [rep, paid, s] = await Promise.all([computeRentReport(start, end), rentSettlement(period), getSettings()]);
  const today = todayISO();
  const roomOpts = rep.byRoom.filter((r) => r.room.isActive).map((r) => ({ id: r.room.id, name: r.room.name, rates: r.room.rates ?? {} }));
  const roomName = new Map(rep.byRoom.map((r) => [r.room.id, r.room.name]));
  return (
    <div className="space-y-6">
      <PageHeader kicker="Finances" title="Location des salles" subtitle={`Calcul selon la ${BASIS[rep.basis]} · tarifs : ${s.sessions.days.map((d) => `${d.label.toLowerCase()}`).join(' / ')} définis dans Salles.`}
        actions={<>
          <a href={`/api/pdf/location?mois=${period}`} target="_blank" className="btn btn-gold"><FileDown size={17} /> État de location (PDF)</a>
          {!paid && roomOpts.length > 0 && (
            <Modal title="Ajouter une date de location" subtitle={`État de ${periodLabel(period)} : date, séances, durée et tarif par heure`} size="lg" trigger={<button className="btn btn-ghost"><CalendarPlus size={17} /> Ajouter une date</button>}>
              <RentEntryForm rooms={roomOpts} defaultDate={today >= start && today <= end ? today : start} min={start} max={end} />
            </Modal>
          )}
          {!paid && rep.total > 0 && <ActionButton action={payRent.bind(null, period)} className="btn btn-success" confirm={`Enregistrer le règlement de ${money(rep.total)} pour ${periodLabel(period)} ? Une dépense sera créée.`}>Marquer comme réglé</ActionButton>}
        </>} />
      <form method="get" className="card flex flex-wrap items-end gap-2 p-3 sm:p-4">
        <label><span className="label">Mois</span><input type="month" name="mois" className="input" defaultValue={period} /></label>
        <button className="btn btn-navy">Afficher</button>
        {paid && <Badge tone="green"><CheckCircle2 size={13} /> Réglé le {dateTimeFr(paid.paidAt)} ({money(paid.amount)})</Badge>}
      </form>
      {paid ? (
        <p className="flex items-start gap-2 rounded-xl bg-navy-50/60 p-3 text-sm text-slate-700"><Lock size={16} className="mt-0.5 shrink-0 text-slate-500" aria-hidden /> Location de {periodLabel(period)} réglée : l&apos;état est verrouillé. Pour ajouter ou supprimer une date, supprimez d&apos;abord la dépense « Location des salles — {periodLabel(period)} » dans Dépenses.</p>
      ) : (
        <p className="text-sm text-slate-600">L&apos;état est calculé à partir des séances. Vous pouvez <strong>ajouter une date</strong> (séance hors planning, examen, réunion…) ou <strong>supprimer une ligne</strong> qui ne doit pas être facturée ; une ligne calculée supprimée peut être rétablie.</p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Total ${periodLabel(period)}`} value={money(rep.total)} tone="gold" icon={<Building2 size={20} />} />
        <Stat label="Heures de location" value={hours(rep.minutes)} tone="navy" />
        {[...rep.byDay].map(([d, v]) => <Stat key={d} label={`${DAYS[d]}s`} value={money(v.amount)} hint={hours(v.minutes)} tone={d === 0 ? 'violet' : 'blue'} />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {rep.byRoom.map((r) => (
          <Card key={r.room.id} title={r.room.name} subtitle={`${hours(r.minutes)} · ${money(r.amount)}`} pad={false}>
            {r.lines.length === 0 ? <Empty title="Aucune utilisation ce mois-ci" /> : (
              <TableWrap>
                <table className="tbl">
                  <thead><tr><th>Date</th><th className="text-center">Séances</th><th className="text-right">Durée</th><th className="text-right">Tarif / h</th><th className="text-right">Montant</th>{!paid && <th className="w-10"><span className="sr-only">Actions</span></th>}</tr></thead>
                  <tbody>
                    {r.lines.map((l) => (
                      <tr key={`${l.source}-${l.entryId ?? l.date}`}>
                        <td>
                          <span className="first-up">{DAYS[l.dayOfWeek]}</span> {dateFr(l.date)}
                          {l.source === 'MANUEL' && <p className="flex flex-wrap items-center gap-1 text-xs text-slate-500"><Badge tone="gold">Ajout</Badge>{l.label}</p>}
                        </td>
                        <td className="text-center">{l.seances}</td><td className="text-right">{duration(l.minutes)}</td><td className="text-right">{money(l.rate)}</td><td className="text-right font-semibold">{money(l.amount)}</td>
                        {!paid && (
                          <td className="text-right">
                            <ActionButton
                              action={deleteRentLine.bind(null, l.source === 'MANUEL' ? { entryId: l.entryId } : { roomId: l.roomId, date: l.date })}
                              confirm={l.source === 'MANUEL' ? `Supprimer la journée ajoutée du ${dateFr(l.date)} (${money(l.amount)}) ?` : `Retirer le ${dateFr(l.date)} (${money(l.amount)}) de l’état de location ? Vous pourrez la rétablir.`}
                              title={`Supprimer la ligne du ${dateFr(l.date)}`}
                              className="btn-icon hover:text-rose-700"
                            >
                              <Trash2 size={16} aria-hidden />
                            </ActionButton>
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="bg-gold-50"><td colSpan={2} className="font-semibold">Total {r.room.name}</td><td className="text-right font-semibold">{duration(r.minutes)}</td><td /><td className="text-right font-bold">{money(r.amount)}</td>{!paid && <td />}</tr>
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>
        ))}
      </div>
      {rep.excluded.length > 0 && (
        <Card title="Dates retirées de l’état" subtitle="Journées calculées à partir des séances mais non facturées. Rétablissez-les si besoin." pad={false}>
          <TableWrap>
            <table className="tbl">
              <thead><tr><th>Salle</th><th>Date</th><th className="text-center">Séances</th><th className="text-right">Durée</th><th className="text-right">Montant non facturé</th>{!paid && <th className="w-32"><span className="sr-only">Actions</span></th>}</tr></thead>
              <tbody>
                {rep.excluded.map((l) => (
                  <tr key={l.entryId}>
                    <td>{roomName.get(l.roomId)}</td><td><span className="first-up">{DAYS[l.dayOfWeek]}</span> {dateFr(l.date)}</td><td className="text-center">{l.seances}</td><td className="text-right">{duration(l.minutes)}</td><td className="text-right text-slate-500 line-through">{money(l.amount)}</td>
                    {!paid && <td className="text-right"><ActionButton action={restoreRentLine.bind(null, l.entryId)} className="btn btn-ghost btn-sm"><Undo2 size={15} aria-hidden /> Rétablir</ActionButton></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}
    </div>
  );
}
