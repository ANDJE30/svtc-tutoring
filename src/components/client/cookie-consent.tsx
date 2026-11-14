'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';

/**
 * Consentement aux cookies et à la mesure d'audience.
 * Le site ne dépose qu'un cookie de session strictement nécessaire (connexion) ; la mesure d'audience, anonyme et sans cookie,
 * n'est activée qu'après accord. Le choix est conservé dans le navigateur (aucun cookie) et modifiable à tout moment.
 */
const KEY = 'svtc_consentement';
export type Consent = 'accepte' | 'refuse';
const OPEN_EVENT = 'svtc:consentement-ouvrir';
export const CONSENT_EVENT = 'svtc:consentement';

export function readConsent(): Consent | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'accepte' || v === 'refuse' ? v : null;
  } catch {
    return null;
  }
}

function writeConsent(v: Consent) {
  try {
    window.localStorage.setItem(KEY, v);
    window.localStorage.setItem(`${KEY}_date`, new Date().toISOString());
  } catch {}
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: v }));
}

export function CookieBanner() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!readConsent()) setOpen(true);
    const show = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);
  if (!open) return null;
  const choose = (v: Consent) => {
    writeConsent(v);
    setOpen(false);
  };
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookies-titre"
      aria-describedby="cookies-texte"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-3xl rounded-2xl border border-navy-100 bg-white p-4 text-left shadow-[var(--shadow-lift)] sm:bottom-5 sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-800"><Cookie size={20} aria-hidden /></span>
          <div className="min-w-0">
            <p id="cookies-titre" className="font-semibold text-navy-950">Cookies et mesure d’audience</p>
            <p id="cookies-texte" className="mt-1 text-sm leading-relaxed text-slate-700">
              Ce site utilise uniquement un cookie de session, strictement nécessaire à la connexion. Avec votre accord, il mesure aussi sa fréquentation
              de façon <strong>anonyme</strong>, sans cookie ni service extérieur.{' '}
              <Link href="/confidentialite#cookies" className="font-medium text-royal-700 underline">En savoir plus</Link>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => choose('refuse')} className="btn btn-ghost flex-1 sm:flex-none">Refuser</button>
          <button type="button" onClick={() => choose('accepte')} className="btn btn-navy flex-1 sm:flex-none">Accepter</button>
        </div>
      </div>
    </div>
  );
}

/** Lien « Gérer les cookies » : rouvre le bandeau pour modifier le choix. */
export function ManageCookiesButton({ className, label = 'Gérer les cookies' }: { className?: string; label?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} className={className}>
      {label}
    </button>
  );
}
