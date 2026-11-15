'use client';

import { useMemo, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { ActionForm, SubmitButton } from '@/components/client/forms';
import { addRentEntry } from '@/app/actions/finance';

type RoomOpt = { id: number; name: string; rates: Record<string, number> };
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const fmt = (n: number) => `${new Intl.NumberFormat('fr-FR').format(n).replace(/ | /g, ' ')} FCFA`;
const weekday = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`).getUTCDay() : null);

/** Ajout d'une journée de location : le tarif par heure est proposé selon la salle et le jour, et reste modifiable. */
export function RentEntryForm({ rooms, defaultDate, min, max }: { rooms: RoomOpt[]; defaultDate: string; min?: string; max?: string }) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? 0);
  const [date, setDate] = useState(defaultDate);
  const [hours, setHours] = useState('2');
  const [mins, setMins] = useState('0');
  const [rateEdited, setRateEdited] = useState(false);
  // Tarif de la salle pour le jour choisi ; null si aucun tarif n'est défini pour ce jour (à saisir)
  const suggested = useMemo<number | null>(() => {
    const d = weekday(date);
    const r = rooms.find((x) => x.id === roomId);
    const v = d === null || !r ? undefined : r.rates?.[String(d)];
    return typeof v === 'number' && v > 0 ? v : null;
  }, [roomId, date, rooms]);
  const [rateInput, setRateInput] = useState('');
  const rate = rateEdited ? rateInput : suggested === null ? '' : String(suggested);
  const minutes = (Number(hours) || 0) * 60 + (Number(mins) || 0);
  const amount = Math.round((minutes / 60) * (Number(rate) || 0));
  const d = weekday(date);
  return (
    <ActionForm action={addRentEntry} className="grid gap-4 sm:grid-cols-2">
      <label><span className="label">Salle</span>
        <select name="roomId" className="input" value={roomId} onChange={(e) => setRoomId(Number(e.target.value))} required>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>
      <label><span className="label">Date</span>
        <input type="date" name="date" className="input" value={date} min={min} max={max} onChange={(e) => setDate(e.target.value)} required />
        {d !== null && <span className="hint first-up">{DAYS[d]}</span>}
      </label>
      <label><span className="label">Nombre de séances</span>
        <input type="number" name="seances" className="input" min={0} max={50} defaultValue={1} required />
      </label>
      <fieldset>
        <legend className="label">Durée de location</legend>
        <div className="flex items-center gap-2">
          <input type="number" name="heures" aria-label="Heures" className="input w-20" min={0} max={24} value={hours} onChange={(e) => setHours(e.target.value)} required />
          <span className="text-sm text-slate-600">h</span>
          <select name="minutes" aria-label="Minutes" className="input w-24" value={mins} onChange={(e) => setMins(e.target.value)}>
            {['0', '15', '30', '45'].map((m) => <option key={m} value={m}>{m.padStart(2, '0')}</option>)}
          </select>
          <span className="text-sm text-slate-600">min</span>
        </div>
      </fieldset>
      <label><span className="label">Tarif par heure (FCFA)</span>
        <input type="number" name="rate" className="input" min={0} max={1000000} value={rate} onChange={(e) => { setRateEdited(true); setRateInput(e.target.value); }} required />
        <span className="hint">
          {rateEdited
            ? <>Tarif saisi{suggested !== null && <> — <button type="button" className="font-medium text-royal-700 underline" onClick={() => setRateEdited(false)}>revenir au tarif de la salle ({fmt(suggested)})</button></>}</>
            : suggested !== null
              ? `Tarif de la salle le ${d !== null ? DAYS[d] : 'jour choisi'}`
              : <span className="text-amber-800">Aucun tarif défini pour le {d !== null ? DAYS[d] : 'jour choisi'} dans Salles : saisissez le tarif.</span>}
        </span>
      </label>
      <label><span className="label">Motif (facultatif)</span>
        <input name="label" className="input" maxLength={120} placeholder="Ex. : séance de rattrapage, examen blanc" />
      </label>
      <div className="rounded-xl bg-gold-50 p-3 text-sm text-navy-900 sm:col-span-2">
        Montant de la ligne : <strong>{fmt(amount)}</strong> ({Math.floor(minutes / 60)} h {String(minutes % 60).padStart(2, '0')} × {fmt(Number(rate) || 0)}/h)
      </div>
      <div className="sm:col-span-2"><SubmitButton><CalendarPlus size={16} aria-hidden /> Ajouter à l&apos;état de location</SubmitButton></div>
    </ActionForm>
  );
}
