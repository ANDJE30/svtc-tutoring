/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import {
  Laptop, Code2, Database, Wrench, ShieldCheck, MapPin, Phone, GraduationCap, Users, ClipboardList, Award, ArrowDown, CheckCircle2, CalendarDays, Clock, LogIn,
} from 'lucide-react';
import { Logo, Motto, CircuitLines } from '@/components/brand';
import { EnrollmentForm } from '@/components/client/enrollment-form';
import { ManageCookiesButton } from '@/components/client/cookie-consent';
import { publicSettings, logoUrl } from '@/lib/public-settings';
import { formToken } from '@/lib/antispam';
import { phoneFr, hm } from '@/lib/format';
import { db } from '@/db';
import { classes } from '@/db/schema';

// Jeton anti-robot horodaté : la page doit être rendue à chaque visite
export const dynamic = 'force-dynamic';

const DOMAINES = [
  { icon: Laptop, title: 'Informatique générale', text: 'Maîtrisez les bases et outils essentiels.' },
  { icon: Code2, title: 'Algorithmique et programmation', text: 'Apprenez à résoudre des problèmes et à créer des solutions.' },
  { icon: Database, title: "Système d'information", text: "Comprenez la conception et la gestion des systèmes d'information." },
  { icon: Wrench, title: 'Maintenance – Réseau – Création numérique', text: 'Développez des compétences pratiques et techniques.' },
  { icon: ShieldCheck, title: 'Réseau – Internet – Sécurité informatique', text: 'Explorez les réseaux, Internet et la cybersécurité.' },
];

const ATOUTS = [
  { icon: Users, title: 'Formateurs expérimentés', text: 'Encadrement par des professionnels de l’informatique.' },
  { icon: Laptop, title: 'Approche pratique', text: 'Méthodes modernes, pratique orientée projet et résultats.' },
  { icon: ClipboardList, title: 'Suivi personnalisé', text: 'Présences, évaluations régulières et bilans envoyés aux parents.' },
  { icon: Award, title: 'Examens officiels', text: 'Préparation au BEPC, Probatoire et Baccalauréat avec excellence.' },
];

async function activeClasses() {
  try {
    return await db.select({ id: classes.id, name: classes.name }).from(classes).where(eq(classes.isActive, true)).orderBy(asc(classes.sortOrder));
  } catch {
    return [];
  }
}

export default async function Home() {
  const [s, cls] = await Promise.all([publicSettings(), activeClasses()]);
  const id = s.identity;
  return (
    <main className="bg-white">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-navy-950">Aller au contenu</a>
      {/* En-tête */}
      <section className="circuit-bg relative overflow-hidden bg-navy-950 text-white">
        <CircuitLines className="absolute -left-24 top-0 w-[620px] opacity-50" />
        <CircuitLines className="absolute -right-24 bottom-0 w-[620px] rotate-180 opacity-40" />
        <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-4" aria-label="Navigation principale">
          <Link href="/" className="flex items-center gap-3">
            <Logo variant="emblem" className="h-10 w-auto" logoUrl={logoUrl(s)} />
            <span className="hidden text-sm font-semibold tracking-wide sm:inline">{id.shortName} · Répétitions</span>
          </Link>
          <Link href="/connexion" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-navy-100 underline-offset-4 hover:text-white hover:underline">
            <LogIn size={16} aria-hidden /> Se connecter
          </Link>
        </nav>
        <div id="contenu" className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-6 md:grid-cols-2 md:pb-24 md:pt-10">
          <div className="animate-fade-up">
            <Logo className="mb-6 h-28 w-auto sm:h-40" logoUrl={logoUrl(s)} sizes="(min-width: 640px) 245px, 170px" />
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              COMPRENDRE. <span className="text-gold-400">PRATIQUER.</span> MAÎTRISER.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-navy-50">{id.description}</p>
            <a href="#inscription" className="btn btn-gold mt-7 px-6 py-3.5 text-base shadow-lg">
              Inscrire mon enfant <ArrowDown size={18} aria-hidden />
            </a>
            <p className="mt-6 flex items-start gap-2 text-sm text-navy-50">
              <MapPin size={18} className="mt-0.5 shrink-0 text-gold-400" aria-hidden />
              <span>Au niveau du <strong className="text-white">{id.host}</strong>, {id.city}, {id.address}.</span>
            </p>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-tr from-gold-400/30 via-sky-400/10 to-transparent blur-2xl" aria-hidden />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl">
              <img src="/brand/hero-students.webp" width={439} height={425} fetchPriority="high" alt="Deux élèves travaillent sur ordinateur pendant une séance de répétition" className="h-72 w-full object-cover sm:h-96" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-navy-950/95 to-transparent p-5">
                <p className="text-lg font-semibold">Réussissez aujourd&apos;hui, brillez demain !</p>
              </div>
            </div>
          </div>
        </div>
        <div className="gold-rule" />
      </section>

      {/* Séances */}
      <section className="mx-auto max-w-6xl px-5 py-14" aria-labelledby="seances">
        <h2 id="seances" className="sr-only">Séances de répétition</h2>
        <div className="grid gap-5 md:grid-cols-3">
          <div className="card p-6 md:col-span-1">
            <GraduationCap className="text-royal-600" aria-hidden />
            <h3 className="mt-3 text-lg font-semibold text-navy-950">Cours de répétitions & préparation aux examens officiels</h3>
            <p className="mt-2 text-sm text-slate-700">Pour les élèves de la 6ème en Terminale (dont Première et Terminale TI) dans le domaine de l&apos;informatique.</p>
          </div>
          {s.sessions.days.map((d) => (
            <div key={d.day} className="card flex items-center gap-4 p-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-navy-950 text-gold-400"><CalendarDays aria-hidden /></div>
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-slate-600">Séance du</p>
                <p className="text-xl font-semibold text-navy-950">{d.label}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-700"><Clock size={15} aria-hidden /> {hm(d.start)} – {hm(d.end)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Domaines */}
      <section className="bg-navy-50/60 py-14" aria-labelledby="domaines">
        <div className="mx-auto max-w-6xl px-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-700">Domaines de formation</p>
          <h2 id="domaines" className="mt-2 text-2xl font-semibold text-navy-950">Tout le programme d&apos;informatique, du collège au lycée</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {DOMAINES.map((d) => (
              <div key={d.title} className="card p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-royal-500 to-navy-900 text-white"><d.icon size={20} aria-hidden /></div>
                <h3 className="mt-4 text-[15px] font-semibold text-navy-950">{d.title}</h3>
                <p className="mt-1 text-sm text-slate-700">{d.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pour qui & atouts */}
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-2" aria-labelledby="pourqui">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-700">Pour qui ?</p>
          <h2 id="pourqui" className="mt-2 text-2xl font-semibold text-navy-950">Élèves de la 6ème en Terminale qui souhaitent :</h2>
          <ul className="mt-6 space-y-3">
            {['Renforcer leurs connaissances', 'Rattraper des notions mal comprises', 'Préparer efficacement leurs examens', 'Développer des compétences numériques', 'Se préparer pour l’avenir'].map((t) => (
              <li key={t} className="flex items-center gap-3 text-[15px] text-navy-900"><CheckCircle2 className="shrink-0 text-gold-600" size={20} aria-hidden /> {t}</li>
            ))}
          </ul>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {ATOUTS.map((a) => (
            <div key={a.title} className="rounded-2xl border border-gold-200 bg-gold-50/50 p-5">
              <a.icon className="text-gold-700" aria-hidden />
              <h3 className="mt-3 font-semibold text-navy-950">{a.title}</h3>
              <p className="mt-1 text-sm text-slate-700">{a.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Appel à l'action unique : demande d'inscription */}
      <section id="inscription" className="circuit-bg scroll-mt-4 bg-navy-950 py-16" aria-labelledby="titre-inscription">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[1fr_1.4fr]">
          <div className="text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">Inscriptions ouvertes</p>
            <h2 id="titre-inscription" className="mt-2 text-3xl font-semibold leading-tight">Inscrire mon enfant aux répétitions</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-navy-50">Remplissez ce court formulaire : le centre vous rappelle pour confirmer la classe, les horaires et les frais. Vous recevrez ensuite vos accès à l&apos;espace parents pour suivre le planning, les présences et les notes de votre enfant.</p>
            <ul className="mt-6 space-y-2 text-sm text-navy-50">
              {['Deux séances par semaine (mercredi et dimanche)', 'Suivi des présences et des notes en ligne', 'Bilans réguliers envoyés aux parents'].map((t) => (
                <li key={t} className="flex items-center gap-2"><CheckCircle2 size={17} className="text-gold-400" aria-hidden /> {t}</li>
              ))}
            </ul>
            <div className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">Ou appelez-nous</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {id.phones.map((p) => (
                  <a key={p} href={`tel:+237${p}`} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 font-semibold tracking-wide ring-1 ring-white/15 hover:bg-white/15">
                    <Phone size={16} className="text-gold-400" aria-hidden /> {phoneFr(p)}
                  </a>
                ))}
              </div>
            </div>
          </div>
          <EnrollmentForm token={formToken()} classes={cls} whatsapp={id.whatsapp || id.phones[0]} />
        </div>
      </section>

      {/* Pied */}
      <footer className="bg-navy-950 text-white">
        <div className="gold-rule" />
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-2">
          <div>
            <Motto className="text-lg text-navy-50" />
            <p className="mt-6 text-sm italic text-gold-300">{id.slogan}</p>
          </div>
          <div className="text-sm text-navy-100 md:text-right">
            <p className="font-semibold text-white">{id.name}</p>
            <p className="mt-1">{id.host} · {id.address}, {id.city} – {id.country}</p>
            <p className="mt-1">{id.phones.map((p) => phoneFr(p)).join(' · ')}</p>
            <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-2 md:justify-end" aria-label="Liens du pied de page">
              <Link href="/connexion" className="underline-offset-4 hover:text-white hover:underline">Espaces parents, encadreurs et administration</Link>
              <Link href="/confidentialite" className="underline-offset-4 hover:text-white hover:underline">Confidentialité et mentions légales</Link>
              <Link href="/conditions" className="underline-offset-4 hover:text-white hover:underline">Conditions générales</Link>
              <ManageCookiesButton className="underline-offset-4 hover:text-white hover:underline" />
              <Link href="/verifier" className="underline-offset-4 hover:text-white hover:underline">Vérifier un reçu</Link>
            </nav>
          </div>
        </div>
        <p className="pb-6 text-center text-xs text-navy-200">© {new Date().getFullYear()} {id.name}. Tous droits réservés.</p>
      </footer>
    </main>
  );
}
