import 'server-only';
import { inArray } from 'drizzle-orm';
import { db } from '@/db';
import { rentPeriods } from '@/db/schema';
import { getSettings } from './settings';
import { rentDefaultBounds, rentPeriodForDate } from './calc';
import { addDays, addMonths } from './time';

export type RentBounds = {
  period: string; start: string; end: string;
  /** Intervalle fixé pour ce mois (saisi ou figé au règlement) */
  custom: boolean;
  /** Début ou fin déplacés pour se raccorder à un mois voisin dont l'intervalle est fixé */
  chained: boolean;
  defaultStart: string; defaultEnd: string; notes: string | null;
};

/**
 * Intervalles effectifs de mois de location. Un mois sans intervalle fixé suit le jour de début des paramètres,
 * mais se raccorde aux mois voisins dont l'intervalle est fixé : il commence le lendemain de la fin du mois précédent
 * et se termine la veille du début du mois suivant. Aucune journée n'est ainsi comptée deux fois ni oubliée.
 */
export async function rentBoundsMany(periods: string[]): Promise<Map<string, RentBounds>> {
  const s = await getSettings();
  const all = [...new Set(periods.flatMap((p) => [addMonths(p, -1), p, addMonths(p, 1)]))];
  const rows = all.length ? await db.select().from(rentPeriods).where(inArray(rentPeriods.period, all)) : [];
  const custom = new Map(rows.map((r) => [r.period, r]));
  return new Map<string, RentBounds>(
    periods.map((p): [string, RentBounds] => {
      const d = rentDefaultBounds(p, s.billing.rentStartDay);
      const own = custom.get(p);
      if (own) return [p, { period: p, start: own.startDate, end: own.endDate, custom: true, chained: false, defaultStart: d.start, defaultEnd: d.end, notes: own.notes ?? null }];
      const prev = custom.get(addMonths(p, -1));
      const next = custom.get(addMonths(p, 1));
      const start = prev ? addDays(prev.endDate, 1) : d.start;
      const end = next ? addDays(next.startDate, -1) : d.end;
      return [p, { period: p, start, end, custom: false, chained: start !== d.start || end !== d.end, defaultStart: d.start, defaultEnd: d.end, notes: null }];
    }),
  );
}

export async function rentPeriodBounds(period: string): Promise<RentBounds> {
  return (await rentBoundsMany([period])).get(period)!;
}

/** Mois de location d'une date (peut être le mois précédent ou suivant lorsque le mois de location chevauche deux mois). */
export async function rentPeriodOfDate(date: string): Promise<string> {
  const own = date.slice(0, 7);
  const map = await rentBoundsMany([addMonths(own, -1), own, addMonths(own, 1)]);
  return rentPeriodForDate(date, (p) => map.get(p) ?? { start: '9999-12-31', end: '0000-01-01' });
}
