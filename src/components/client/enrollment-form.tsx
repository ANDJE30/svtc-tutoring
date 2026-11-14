'use client';

import { useState } from 'react';
import { CheckCircle2, MessageCircle, Send } from 'lucide-react';
import { ActionForm, SubmitButton } from './forms';
import { submitEnrollmentRequest } from '@/app/actions/public';
import { PHONE_PATTERN, PHONE_TITLE } from '@/lib/format';

export function EnrollmentForm({ token, classes, whatsapp }: { token: string; classes: { id: number; name: string }[]; whatsapp: string }) {
  const [done, setDone] = useState<string | null>(null);
  if (done) {
    return (
      <div role="status" className="rounded-3xl bg-white p-8 text-center shadow-[var(--shadow-lift)]">
        <CheckCircle2 size={52} className="mx-auto text-emerald-700" aria-hidden />
        <p className="mt-4 text-xl font-semibold text-navy-950">Demande envoyée</p>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-slate-700">{done}</p>
        <a href={`https://wa.me/237${whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn mt-6 bg-emerald-700 text-white hover:bg-emerald-800"><MessageCircle size={18} aria-hidden /> Écrire au centre sur WhatsApp</a>
      </div>
    );
  }
  return (
    <ActionForm action={submitEnrollmentRequest} closeOnSuccess={false} onSuccess={(r) => setDone(r?.message ?? 'Merci !')} className="relative grid gap-4 rounded-3xl bg-white p-6 shadow-[var(--shadow-lift)] sm:grid-cols-2 sm:p-8">
      <input type="hidden" name="token" value={token} />
      {/* Champ piège invisible pour les robots : ne pas remplir */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Site web <input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="sm:col-span-2"><span className="label">Nom du parent ou tuteur *</span>
        <input name="parentName" required minLength={3} maxLength={100} autoComplete="name" className="input" placeholder="Ex. : Mme ATANGANA Marie" /></label>
      <label><span className="label">Téléphone (WhatsApp de préférence) *</span>
        <input name="phone" type="tel" required inputMode="tel" autoComplete="tel" pattern={PHONE_PATTERN} title={PHONE_TITLE} className="input" placeholder="6XX XX XX XX" /></label>
      <label><span className="label">E-mail (facultatif)</span>
        <input name="email" type="email" maxLength={120} autoComplete="email" className="input" placeholder="nom@exemple.cm" /></label>
      <label><span className="label">Nom de l&apos;enfant *</span>
        <input name="childLastName" required maxLength={60} className="input uppercase" placeholder="ATANGANA" /></label>
      <label><span className="label">Prénom(s) de l&apos;enfant *</span>
        <input name="childFirstName" required maxLength={80} className="input" placeholder="Junior" /></label>
      <label><span className="label">Classe</span>
        <select name="classId" className="input" defaultValue="">
          <option value="">Je ne sais pas encore</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></label>
      <label><span className="label">Établissement fréquenté</span>
        <input name="school" maxLength={120} className="input" placeholder="Ex. : Lycée de Biyem-Assi" /></label>
      <label className="sm:col-span-2"><span className="label">Votre besoin (facultatif)</span>
        <textarea name="message" maxLength={600} rows={3} className="input" placeholder="Ex. : préparation au Probatoire, difficultés en algorithmique…" /></label>
      <label className="flex items-start gap-3 text-sm text-slate-700 sm:col-span-2">
        <input type="checkbox" name="consent" required className="check mt-0.5" />
        <span>J&apos;accepte que la SVTC utilise ces informations pour me recontacter au sujet de l&apos;inscription, conformément à la <a href="/confidentialite" className="font-medium text-royal-700 underline">politique de confidentialité</a> et aux <a href="/conditions" className="font-medium text-royal-700 underline">conditions générales</a>.</span>
      </label>
      <div className="sm:col-span-2">
        <SubmitButton className="btn btn-gold w-full py-3.5 text-base" pendingText="Envoi en cours…"><Send size={18} aria-hidden /> Envoyer ma demande d&apos;inscription</SubmitButton>
        <p className="mt-2 text-center text-xs text-slate-600">Réponse rapide par téléphone ou WhatsApp. Aucun paiement en ligne n&apos;est demandé.</p>
      </div>
    </ActionForm>
  );
}
