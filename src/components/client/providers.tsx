'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';
import { CookieBanner, CONSENT_EVENT, readConsent, type Consent } from './cookie-consent';

/**
 * Mesure d'audience anonyme à chaque changement de page, uniquement après consentement
 * (bandeau cookies) et si le navigateur ne demande pas « Ne pas me pister ».
 */
let firstView = true;

function sendView(path: string) {
  try {
    const body = JSON.stringify({ p: path, r: firstView ? document.referrer : '' });
    firstView = false;
    if (!navigator.sendBeacon?.('/api/audience', body)) {
      fetch('/api/audience', { method: 'POST', body, keepalive: true }).catch(() => {});
    }
  } catch {}
}

function AudienceBeacon() {
  const path = usePathname();
  useEffect(() => {
    if (!path || navigator.doNotTrack === '1') return;
    if (readConsent() === 'accepte') {
      sendView(path);
      return;
    }
    // Pas encore de choix : la page en cours est comptée seulement si le visiteur accepte
    const onChoice = (e: Event) => {
      if ((e as CustomEvent<Consent>).detail === 'accepte') sendView(path);
    };
    window.addEventListener(CONSENT_EVENT, onChoice);
    return () => window.removeEventListener(CONSENT_EVENT, onChoice);
  }, [path]);
  return null;
}

export function AppProviders(_props: { nonce?: string }) {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return (
    <>
      <AudienceBeacon />
      <CookieBanner />
      <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: 'Poppins, sans-serif' } }} />
    </>
  );
}
