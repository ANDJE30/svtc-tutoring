'use server';

import { revalidatePath } from 'next/cache';
import { and, desc, eq, inArray, like } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { payments, students, expenses, salarySlips, rentSettlements, rentEntries, rentPeriods, rooms, tutors, verifications } from '@/db/schema';
import { rentBoundsMany, rentPeriodBounds, rentPeriodOfDate } from '@/lib/rent-period';
import { assertRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { formObject, safe, UserError, zs, type ActionResult } from '@/lib/action';
import { getCurrentYear, getSettings } from '@/lib/settings';
import { computePayroll, computeRentReport, rentPaid } from '@/lib/payroll';
import { addDays, addMonths, dayOfWeek, localToDate, nowHM, periodBounds, todayISO } from '@/lib/time';
import { periodLabel, money, dateFr } from '@/lib/format';
import { randomCode } from '@/lib/passwords';
import { PAYMENT_METHODS } from '@/lib/constants';

const paths = ['/admin/paiements', '/admin/impayes', '/admin/caisse', '/admin', '/admin/eleves'];
const refresh = (extra: string[] = []) => [...paths, ...extra].forEach((p) => revalidatePath(p));

async function nextReceiptNo(prefix: string, yearLabel: string) {
  const base = `${prefix}-R${yearLabel.slice(2, 4)}${yearLabel.slice(7, 9)}`;
  const [last] = await db.select({ n: payments.receiptNo }).from(payments).where(like(payments.receiptNo, `${base}-%`)).orderBy(desc(payments.receiptNo)).limit(1);
  const n = last ? Number(last.n.split('-').pop()) + 1 : 1;
  return `${base}-${String(n).padStart(5, '0')}`;
}

const paymentSchema = z.object({
  studentId: zs.id('Élève'),
  amount: zs.int('Montant', 1, 10_000_000),
  type: z.enum(['INSCRIPTION', 'MENSUALITE', 'AUTRE']),
  method: z.enum(Object.keys(PAYMENT_METHODS) as [string, ...string[]]),
  reference: zs.optText(80),
  paidOn: zs.date('Date du paiement'),
  notes: zs.optText(300),
});

export async function recordPayment(fd: FormData): Promise<ActionResult<{ id: number; receiptNo: string }>> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const d = paymentSchema.parse({ paidOn: todayISO(), ...formObject(fd) });
    if (d.paidOn > todayISO()) throw new UserError('La date du paiement ne peut pas être dans le futur.');
    if ((d.method === 'MTN_MOMO' || d.method === 'ORANGE_MONEY') && !d.reference) throw new UserError('Indiquez la référence de la transaction Mobile Money.');
    const [st] = await db.select().from(students).where(eq(students.id, d.studentId));
    if (!st) throw new UserError('Élève introuvable.');
    const [year, s] = await Promise.all([getCurrentYear(), getSettings()]);
    const paidAt = d.paidOn === todayISO() ? new Date() : localToDate(d.paidOn, '12:00');
    let row: { id: number; receiptNo: string } | undefined;
    for (let attempt = 0; attempt < 4 && !row; attempt++) {
      try {
        const receiptNo = await nextReceiptNo(s.billing.receiptPrefix, year.label);
        [row] = await db.insert(payments).values({
          receiptNo, academicYearId: st.academicYearId, studentId: st.id, amount: d.amount, type: d.type, method: d.method,
          reference: d.reference ?? null, paidAt, receivedBy: me.id, notes: d.notes ?? null,
        }).returning({ id: payments.id, receiptNo: payments.receiptNo });
      } catch (e) {
        if ((e as { code?: string }).code !== '23505' || attempt === 3) throw e;
      }
    }
    const code = randomCode(10);
    await db.insert(verifications).values({
      code, kind: 'RECU', refId: String(row!.id),
      summary: { 'Reçu n°': row!.receiptNo, Élève: `${st.lastName} ${st.firstName}`, Montant: money(d.amount), Date: `${d.paidOn.split('-').reverse().join('/')} ${d.paidOn === todayISO() ? nowHM() : ''}`.trim() },
    }).onConflictDoNothing();
    await audit(me, 'PAIEMENT_ENREGISTRE', { entity: 'paiement', entityId: row!.id, details: { receiptNo: row!.receiptNo, amount: d.amount, studentId: st.id } });
    refresh([`/admin/eleves/${st.id}`]);
    return { ok: true, message: `Paiement enregistré — reçu ${row!.receiptNo}.`, data: row! };
  });
}

export async function cancelPayment(id: number, fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const reason = zs.text('Motif de l’annulation', 200).parse(fd.get('reason'));
    const [p] = await db.select().from(payments).where(eq(payments.id, id));
    if (!p) throw new UserError('Paiement introuvable.');
    if (p.cancelled) throw new UserError('Ce paiement est déjà annulé.');
    await db.update(payments).set({ cancelled: true, cancelReason: reason, cancelledAt: new Date(), cancelledBy: me.id }).where(eq(payments.id, id));
    await audit(me, 'PAIEMENT_ANNULE', { entity: 'paiement', entityId: id, details: { receiptNo: p.receiptNo, amount: p.amount, reason } });
    refresh([`/admin/eleves/${p.studentId}`]);
    return { ok: true, message: `Reçu ${p.receiptNo} annulé (conservé dans l’historique).` };
  });
}

// ---------------------------------------------------------------- Dépenses
const expenseSchema = z.object({
  date: zs.date('Date'),
  category: z.enum(['LOCATION_SALLE', 'SALAIRE', 'FOURNITURES', 'COMMUNICATION', 'TRANSPORT', 'ENTRETIEN', 'AUTRE']),
  label: zs.text('Libellé', 160),
  amount: zs.int('Montant', 1, 100_000_000),
  method: z.enum(Object.keys(PAYMENT_METHODS) as [string, ...string[]]),
  beneficiary: zs.optText(120),
  reference: zs.optText(80),
});

export async function recordExpense(fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const d = expenseSchema.parse({ date: todayISO(), method: 'ESPECES', ...formObject(fd) });
    const year = await getCurrentYear();
    const [row] = await db.insert(expenses).values({ ...d, academicYearId: year.id, createdBy: me.id }).returning({ id: expenses.id });
    await audit(me, 'DEPENSE_ENREGISTREE', { entity: 'depense', entityId: row.id, details: { amount: d.amount, label: d.label } });
    refresh(['/admin/depenses']);
    return { ok: true, message: 'Dépense enregistrée.' };
  });
}

export async function deleteExpense(id: number) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const [e] = await db.select().from(expenses).where(eq(expenses.id, id));
    if (!e) throw new UserError('Dépense introuvable.');
    await db.transaction(async (tx) => {
      if (e.sourceType === 'SALAIRE') await tx.update(salarySlips).set({ status: 'CALCULE', paidAt: null, expenseId: null }).where(eq(salarySlips.expenseId, id));
      if (e.sourceType === 'LOCATION' && e.sourceRef) {
        // Règlement du mois recalculé à partir des dépenses de location restantes (règlement initial et compléments)
        const rest = (await tx.select({ id: expenses.id, amount: expenses.amount }).from(expenses).where(and(eq(expenses.sourceType, 'LOCATION'), eq(expenses.sourceRef, e.sourceRef)))).filter((x) => x.id !== id);
        if (rest.length === 0) await tx.delete(rentSettlements).where(eq(rentSettlements.period, e.sourceRef));
        else await tx.update(rentSettlements).set({ amount: rest.reduce((a, x) => a + x.amount, 0), expenseId: rest[0].id }).where(eq(rentSettlements.period, e.sourceRef));
      } else if (e.sourceType === 'LOCATION') await tx.delete(rentSettlements).where(eq(rentSettlements.expenseId, id));
      await tx.delete(expenses).where(eq(expenses.id, id));
    });
    await audit(me, 'DEPENSE_SUPPRIMEE', { entity: 'depense', entityId: id, details: { amount: e.amount, label: e.label } });
    refresh(['/admin/depenses', '/admin/salaires', '/admin/location']);
    return { ok: true, message: 'Dépense supprimée.' };
  });
}

// ---------------------------------------------------------------- Salaires
export async function saveSalaryAdjustments(period: string, fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    zs.period().parse(period);
    const payroll = await computePayroll(period);
    for (const r of payroll.rows) {
      if (r.slip?.status === 'PAYE') continue;
      const bonus = Math.max(0, Number(fd.get(`bonus_${r.tutor.id}`) ?? r.bonus) || 0);
      const deduction = Math.max(0, Number(fd.get(`deduction_${r.tutor.id}`) ?? r.deduction) || 0);
      const net = Math.max(0, r.gross + bonus - deduction);
      const values = {
        tutorId: r.tutor.id, period, mode: payroll.mode, plannedMinutes: r.planned, doneMinutes: r.done, ratePct: r.ratePct,
        baseSalary: r.tutor.baseSalary, hourlyRate: r.tutor.hourlyRate, grossAmount: r.gross, bonus, deduction, netAmount: net,
      };
      await db.insert(salarySlips).values(values).onConflictDoUpdate({ target: [salarySlips.tutorId, salarySlips.period], set: values });
    }
    await audit(me, 'SALAIRES_CALCULES', { details: { period } });
    revalidatePath('/admin/salaires');
    return { ok: true, message: `État des salaires de ${periodLabel(period)} enregistré.` };
  });
}

export async function paySalary(period: string, tutorId: number, fd?: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    zs.period().parse(period);
    const payroll = await computePayroll(period);
    const r = payroll.rows.find((x) => x.tutor.id === tutorId);
    if (!r) throw new UserError('Encadreur introuvable pour cette période.');
    if (r.slip?.status === 'PAYE') throw new UserError('Ce salaire est déjà payé.');
    if (r.net <= 0) throw new UserError('Montant nul : aucun paiement à enregistrer.');
    const method = String(fd?.get('method') ?? 'ESPECES');
    const year = await getCurrentYear();
    await db.transaction(async (tx) => {
      const [e] = await tx.insert(expenses).values({
        academicYearId: year.id, date: todayISO(), category: 'SALAIRE', label: `Salaire ${periodLabel(period)} — ${r.tutor.firstName} ${r.tutor.lastName}`,
        amount: r.net, method: method in PAYMENT_METHODS ? method : 'ESPECES', beneficiary: `${r.tutor.firstName} ${r.tutor.lastName}`, sourceType: 'SALAIRE', sourceRef: `${period}:${tutorId}`, createdBy: me.id,
      }).returning({ id: expenses.id });
      const values = {
        tutorId, period, mode: payroll.mode, plannedMinutes: r.planned, doneMinutes: r.done, ratePct: r.ratePct, baseSalary: r.tutor.baseSalary, hourlyRate: r.tutor.hourlyRate,
        grossAmount: r.gross, bonus: r.bonus, deduction: r.deduction, netAmount: r.net, status: 'PAYE', paidAt: new Date(), expenseId: e.id,
      };
      await tx.insert(salarySlips).values(values).onConflictDoUpdate({ target: [salarySlips.tutorId, salarySlips.period], set: values });
    });
    await audit(me, 'SALAIRE_PAYE', { entity: 'encadreur', entityId: tutorId, details: { period, amount: r.net } });
    refresh(['/admin/salaires', '/admin/depenses']);
    return { ok: true, message: `Salaire de ${r.tutor.firstName} ${r.tutor.lastName} payé (${money(r.net)}) et inscrit en dépense.` };
  });
}

export async function payAllSalaries(period: string) {
  return safe(async () => {
    await assertRole('ADMIN');
    const payroll = await computePayroll(period);
    let n = 0;
    for (const r of payroll.rows) {
      if (r.slip?.status === 'PAYE' || r.net <= 0) continue;
      const res = await paySalary(period, r.tutor.id);
      if (res.ok) n++;
    }
    if (n === 0) throw new UserError('Aucun salaire à payer pour cette période.');
    return { ok: true, message: `${n} salaire(s) payé(s) pour ${periodLabel(period)}.` };
  });
}

// ---------------------------------------------------------------- Location des salles
export async function payRent(period: string) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    zs.period().parse(period);
    const [existing] = await db.select().from(rentSettlements).where(eq(rentSettlements.period, period));
    if (existing) throw new UserError('La location de ce mois est déjà réglée.');
    const bounds = await rentPeriodBounds(period);
    const { start, end } = bounds;
    const rep = await computeRentReport(start, end);
    if (rep.total <= 0) throw new UserError('Aucune heure de location pour ce mois.');
    const year = await getCurrentYear();
    const s = await getSettings();
    await db.transaction(async (tx) => {
      const [e] = await tx.insert(expenses).values({
        academicYearId: year.id, date: todayISO(), category: 'LOCATION_SALLE', label: `Location des salles — ${periodLabel(period)}`,
        amount: rep.total, method: 'ESPECES', beneficiary: s.identity.host, sourceType: 'LOCATION', sourceRef: period, createdBy: me.id,
      }).returning({ id: expenses.id });
      await tx.insert(rentSettlements).values({ period, amount: rep.total, paidAt: new Date(), expenseId: e.id });
      // L'intervalle sur lequel le mois a été payé est figé : un changement ultérieur des paramètres ne le modifie pas
      await tx.insert(rentPeriods).values({ period, startDate: start, endDate: end, notes: 'Intervalle figé au règlement', updatedBy: me.id }).onConflictDoNothing();
    });
    await audit(me, 'LOCATION_PAYEE', { details: { period, amount: rep.total } });
    refresh(['/admin/location', '/admin/depenses']);
    return { ok: true, message: `Location de ${periodLabel(period)} réglée : ${money(rep.total)}.` };
  });
}

// ---------------------------------------------------------------- Location : ajustements (dates ajoutées ou retirées)
/** Mois de location concerné et indication « déjà réglé » (pour le journal d'audit et le message de retour). */
async function rentPeriodInfo(date: string) {
  const period = await rentPeriodOfDate(date);
  const [paid] = await db.select({ id: rentSettlements.id }).from(rentSettlements).where(eq(rentSettlements.period, period));
  return { period, settled: !!paid };
}
const settledHint = (i: { period: string; settled: boolean }) => (i.settled ? ` Location de ${periodLabel(i.period)} déjà réglée : la différence est indiquée sur la page (complément à régler ou trop-payé).` : '');

const rentEntrySchema = z.object({
  roomId: zs.id('Salle'),
  date: zs.date('Date'),
  seances: zs.int('Nombre de séances', 0, 50),
  heures: zs.int('Heures', 0, 24),
  minutes: zs.int('Minutes', 0, 59),
  rate: zs.int('Tarif par heure', 0, 1_000_000),
  label: zs.optText(120),
});

/** Ajoute une journée de location (date, séances, durée, tarif par heure) à l'état de location. */
export async function addRentEntry(fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const d = rentEntrySchema.parse({ seances: '0', minutes: '0', ...formObject(fd) });
    const total = d.heures * 60 + d.minutes;
    if (total <= 0) throw new UserError('Indiquez la durée de location (heures et/ou minutes).');
    if (total > 24 * 60) throw new UserError('La durée ne peut pas dépasser 24 heures.');
    const [room] = await db.select({ id: rooms.id, name: rooms.name }).from(rooms).where(eq(rooms.id, d.roomId));
    if (!room) throw new UserError('Salle introuvable.');
    const info = await rentPeriodInfo(d.date);
    const [row] = await db.insert(rentEntries).values({ kind: 'AJOUT', roomId: d.roomId, date: d.date, seances: d.seances, minutes: total, rate: d.rate, label: d.label || null, createdBy: me.id }).returning({ id: rentEntries.id });
    const amount = Math.round((total / 60) * d.rate);
    await audit(me, 'LOCATION_DATE_AJOUTEE', { entity: 'location', entityId: row.id, details: { salle: room.name, date: d.date, seances: d.seances, minutes: total, tarif: d.rate, montant: amount, moisRegle: info.settled } });
    refresh(['/admin/location', '/admin/depenses']);
    return { ok: true, message: `${room.name} — ${dateFr(d.date)} ajoutée à l’état de location (${money(amount)}).${settledHint(info)}` };
  });
}

/**
 * Supprime une ligne de l'état de location : une journée ajoutée est effacée ;
 * une journée calculée à partir des séances est retirée de l'état (et peut être rétablie).
 */
export async function deleteRentLine(target: { entryId?: number; roomId?: number; date?: string }): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const f = target ?? {};
    if (f.entryId) {
      const id = zs.id().parse(f.entryId);
      const [e] = await db.select().from(rentEntries).where(and(eq(rentEntries.id, id), eq(rentEntries.kind, 'AJOUT')));
      if (!e) throw new UserError('Ligne introuvable.');
      const info = await rentPeriodInfo(e.date);
      await db.delete(rentEntries).where(eq(rentEntries.id, id));
      await audit(me, 'LOCATION_DATE_SUPPRIMEE', { entity: 'location', entityId: id, details: { date: e.date, roomId: e.roomId, minutes: e.minutes, tarif: e.rate, moisRegle: info.settled } });
      refresh(['/admin/location']);
      return { ok: true, message: `Journée du ${dateFr(e.date)} supprimée de l’état de location.${settledHint(info)}` };
    }
    const roomId = zs.id('Salle').parse(f.roomId);
    const date = zs.date('Date').parse(f.date);
    const info = await rentPeriodInfo(date);
    const [already] = await db.select({ id: rentEntries.id }).from(rentEntries).where(and(eq(rentEntries.kind, 'EXCLUSION'), eq(rentEntries.roomId, roomId), eq(rentEntries.date, date)));
    if (!already) {
      const [row] = await db.insert(rentEntries).values({ kind: 'EXCLUSION', roomId, date, createdBy: me.id }).returning({ id: rentEntries.id });
      await audit(me, 'LOCATION_DATE_RETIREE', { entity: 'location', entityId: row.id, details: { roomId, date, jour: dayOfWeek(date), moisRegle: info.settled } });
    }
    refresh(['/admin/location']);
    return { ok: true, message: `Journée du ${dateFr(date)} retirée de l’état de location (rétablissable).${settledHint(info)}` };
  });
}

/** Rétablit une journée calculée qui avait été retirée de l'état de location. */
export async function restoreRentLine(entryId: number): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const [e] = await db.select().from(rentEntries).where(and(eq(rentEntries.id, entryId), eq(rentEntries.kind, 'EXCLUSION')));
    if (!e) throw new UserError('Journée introuvable.');
    const info = await rentPeriodInfo(e.date);
    await db.delete(rentEntries).where(eq(rentEntries.id, entryId));
    await audit(me, 'LOCATION_DATE_RETABLIE', { entity: 'location', entityId: entryId, details: { date: e.date, roomId: e.roomId, moisRegle: info.settled } });
    refresh(['/admin/location']);
    return { ok: true, message: `Journée du ${dateFr(e.date)} rétablie dans l’état de location.${settledHint(info)}` };
  });
}

/**
 * Mois déjà réglé dont l'état a augmenté après ajout de dates : enregistre le complément (nouvelle dépense datée du jour).
 * Les dépenses passées ne sont jamais modifiées, l'état de caisse des périodes antérieures reste inchangé.
 */
export async function payRentComplement(period: string): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    zs.period().parse(period);
    const [settlement] = await db.select().from(rentSettlements).where(eq(rentSettlements.period, period));
    if (!settlement) throw new UserError('Cette location n’est pas encore réglée : utilisez « Marquer comme réglé ».');
    const { start, end } = await rentPeriodBounds(period);
    const [rep, paid] = await Promise.all([computeRentReport(start, end), rentPaid(period)]);
    const diff = rep.total - paid.total;
    if (diff <= 0) throw new UserError('Aucun complément à régler pour ce mois.');
    const year = await getCurrentYear();
    const s = await getSettings();
    await db.transaction(async (tx) => {
      await tx.insert(expenses).values({
        academicYearId: year.id, date: todayISO(), category: 'LOCATION_SALLE', label: `Location des salles — complément ${periodLabel(period)}`,
        amount: diff, method: 'ESPECES', beneficiary: s.identity.host, sourceType: 'LOCATION', sourceRef: period, createdBy: me.id,
      });
      await tx.update(rentSettlements).set({ amount: paid.total + diff }).where(eq(rentSettlements.id, settlement.id));
    });
    await audit(me, 'LOCATION_COMPLEMENT_PAYE', { details: { period, complement: diff, total: paid.total + diff } });
    refresh(['/admin/location', '/admin/depenses']);
    return { ok: true, message: `Complément de ${money(diff)} réglé pour ${periodLabel(period)} (total réglé : ${money(paid.total + diff)}).` };
  });
}

/**
 * Fixe l'intervalle d'un mois de location (il peut couvrir deux mois consécutifs, ex. du 15/10 au 14/11).
 * Les mois voisins sans intervalle fixé se raccordent automatiquement ; un chevauchement avec un mois voisin fixé est refusé.
 */
export async function setRentPeriod(period: string, fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    zs.period().parse(period);
    const start = zs.date('Début').parse(fd.get('start'));
    const end = zs.date('Fin').parse(fd.get('end'));
    const notes = String(fd.get('notes') ?? '').trim().slice(0, 120) || null;
    if (end < start) throw new UserError('La date de fin doit suivre la date de début.');
    const days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
    if (days > 62) throw new UserError('Un mois de location ne peut pas dépasser 62 jours.');
    const prevP = addMonths(period, -1);
    const nextP = addMonths(period, 1);
    const own = periodBounds(period);
    if (start < periodBounds(prevP).start || start > own.end) throw new UserError(`Le début doit se situer en ${periodLabel(prevP)} ou en ${periodLabel(period)}.`);
    if (end < own.start || end > periodBounds(nextP).end) throw new UserError(`La fin doit se situer en ${periodLabel(period)} ou en ${periodLabel(nextP)}.`);
    const fixed = await db.select().from(rentPeriods).where(inArray(rentPeriods.period, [prevP, nextP]));
    const prev = fixed.find((x) => x.period === prevP);
    const next = fixed.find((x) => x.period === nextP);
    if (prev && start <= prev.endDate) throw new UserError(`Chevauchement avec le mois de location de ${periodLabel(prevP)} (du ${dateFr(prev.startDate)} au ${dateFr(prev.endDate)}) : commencez au plus tôt le ${dateFr(addDays(prev.endDate, 1))}.`);
    if (next && end >= next.startDate) throw new UserError(`Chevauchement avec le mois de location de ${periodLabel(nextP)} (du ${dateFr(next.startDate)} au ${dateFr(next.endDate)}) : terminez au plus tard le ${dateFr(addDays(next.startDate, -1))}.`);
    await db.insert(rentPeriods).values({ period, startDate: start, endDate: end, notes, updatedBy: me.id })
      .onConflictDoUpdate({ target: rentPeriods.period, set: { startDate: start, endDate: end, notes, updatedBy: me.id, updatedAt: new Date() } });
    await audit(me, 'LOCATION_INTERVALLE_FIXE', { details: { period, start, end } });
    const nb = await rentBoundsMany([prevP, nextP]);
    const neighbours = [nb.get(prevP)!, nb.get(nextP)!].filter((b) => !b.custom).map((b) => `${periodLabel(b.period)} : du ${dateFr(b.start)} au ${dateFr(b.end)}`);
    // Journées laissées hors de tout mois de location entre deux intervalles fixés
    const gaps = [
      prev && addDays(prev.endDate, 1) < start ? `du ${dateFr(addDays(prev.endDate, 1))} au ${dateFr(addDays(start, -1))}` : null,
      next && addDays(end, 1) < next.startDate ? `du ${dateFr(addDays(end, 1))} au ${dateFr(addDays(next.startDate, -1))}` : null,
    ].filter(Boolean);
    refresh(['/admin/location']);
    return {
      ok: true,
      message: `Mois de location de ${periodLabel(period)} : du ${dateFr(start)} au ${dateFr(end)}.${neighbours.length ? ` Mois voisins raccordés — ${neighbours.join(' ; ')}.` : ''}${gaps.length ? ` Attention : ${gaps.join(' et ')} n’appartient à aucun mois de location (ces journées ne seront pas facturées).` : ''}`,
    };
  });
}

/** Revient à l'intervalle par défaut (jour de début des paramètres) pour un mois de location. */
export async function resetRentPeriod(period: string): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    zs.period().parse(period);
    await db.delete(rentPeriods).where(eq(rentPeriods.period, period));
    await audit(me, 'LOCATION_INTERVALLE_DEFAUT', { details: { period } });
    const b = await rentPeriodBounds(period);
    refresh(['/admin/location']);
    return { ok: true, message: `Mois de location de ${periodLabel(period)} : intervalle par défaut rétabli (du ${dateFr(b.start)} au ${dateFr(b.end)}).` };
  });
}

export async function updateTutorPay(tutorId: number, fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const baseSalary = zs.int('Salaire mensuel', 0, 10_000_000).parse(fd.get('baseSalary'));
    const hourlyRate = zs.int('Taux horaire', 0, 1_000_000).parse(fd.get('hourlyRate'));
    await db.update(tutors).set({ baseSalary, hourlyRate }).where(and(eq(tutors.id, tutorId)));
    await audit(me, 'REMUNERATION_MODIFIEE', { entity: 'encadreur', entityId: tutorId, details: { baseSalary, hourlyRate } });
    revalidatePath('/admin/salaires');
    return { ok: true, message: 'Rémunération mise à jour.' };
  });
}
