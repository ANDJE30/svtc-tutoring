'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Home, RotateCcw } from 'lucide-react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-navy-50/50 px-5 py-16">
      <div className="card w-full max-w-lg p-8 text-center">
        <img src="/brand/emblem-160.webp" width={160} height={86} alt="" className="mx-auto h-12 w-auto" />
        <h1 className="mt-6 text-2xl font-semibold text-navy-950">Un incident est survenu</h1>
        <p className="mt-2 text-[15px] text-slate-700">
          L&apos;opération n&apos;a pas pu aboutir. Réessayez dans un instant ; si le problème persiste, contactez l&apos;administration du centre.
        </p>
        {error.digest && <p className="mt-3 text-xs text-slate-500">Référence de l&apos;incident : <code className="font-mono">{error.digest}</code></p>}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn btn-primary"><RotateCcw size={17} aria-hidden /> Réessayer</button>
          <Link href="/" className="btn btn-ghost"><Home size={17} aria-hidden /> Accueil</Link>
        </div>
      </div>
    </main>
  );
}
