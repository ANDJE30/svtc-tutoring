import Link from 'next/link';
import { Home, LogIn, Phone } from 'lucide-react';
import { Logo, CircuitLines } from '@/components/brand';
import { phoneFr } from '@/lib/format';
import { DEFAULT_SETTINGS } from '@/lib/settings-types';

export const metadata = { title: 'Page introuvable', robots: { index: false } };

export default function NotFound() {
  const id = DEFAULT_SETTINGS.identity;
  return (
    <main className="circuit-bg relative flex min-h-dvh items-center justify-center overflow-hidden bg-navy-950 px-5 py-16 text-white">
      <CircuitLines className="absolute -left-24 top-0 w-[620px] opacity-40" />
      <CircuitLines className="absolute -right-24 bottom-0 w-[620px] rotate-180 opacity-30" />
      <div className="relative w-full max-w-xl text-center">
        <Logo variant="emblem" className="mx-auto h-16 w-auto" />
        <p className="mt-8 bg-gradient-to-b from-gold-300 to-gold-500 bg-clip-text text-[96px] font-bold leading-none tracking-tight text-transparent sm:text-[128px]" aria-hidden>404</p>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Cette page est introuvable</h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-navy-50">
          Le lien est peut-être incomplet, ou la page a été déplacée. Pas d&apos;inquiétude : même les meilleurs programmeurs rencontrent des erreurs 404 !
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-gold px-5 py-3"><Home size={18} aria-hidden /> Retour à l&apos;accueil</Link>
          <Link href="/connexion" className="btn border border-white/20 bg-white/5 px-5 py-3 text-white hover:bg-white/10"><LogIn size={18} aria-hidden /> Se connecter</Link>
        </div>
        <p className="mt-10 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-navy-100">
          <Phone size={15} className="text-gold-400" aria-hidden /> Besoin d&apos;aide ? {id.phones.map((p, i) => (
            <span key={p}>{i > 0 && '· '}<a href={`tel:+237${p}`} className="font-medium text-white underline-offset-4 hover:underline">{phoneFr(p)}</a></span>
          ))}
        </p>
      </div>
    </main>
  );
}
