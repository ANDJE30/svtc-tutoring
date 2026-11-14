'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';

/** Envoie une mesure d'audience anonyme à chaque changement de page (respecte « Ne pas me pister »). */
let firstView = true;

function AudienceBeacon() {
  const path = usePathname();
  useEffect(() => {
    if (!path || navigator.doNotTrack === '1') return;
    try {
      const body = JSON.stringify({ p: path, r: firstView ? document.referrer : '' });
      firstView = false;
      if (!navigator.sendBeacon?.('/api/audience', body)) {
        fetch('/api/audience', { method: 'POST', body, keepalive: true }).catch(() => {});
      }
    } catch {}
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
      <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: 'Poppins, sans-serif' } }} />
    </>
  );
}
