import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/brand';
import { publicSettings, logoUrl } from '@/lib/public-settings';
import { phoneFr } from '@/lib/format';
import { ManageCookiesButton } from '@/components/client/cookie-consent';

export const metadata = {
  title: 'Confidentialité et mentions légales',
  description: 'Données personnelles, mesure d’audience sans cookie, sécurité et mentions légales de la plateforme SVTC Répétitions.',
  alternates: { canonical: '/confidentialite' },
};

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-6">
      <h2 className="text-xl font-semibold text-navy-950">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

export default async function PrivacyPage() {
  const s = await publicSettings();
  const id = s.identity;
  return (
    <main className="min-h-dvh bg-white">
      <header className="bg-navy-950 text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-3"><Logo variant="emblem" className="h-10 w-auto" logoUrl={logoUrl(s)} /><span className="text-sm font-semibold">{id.shortName} · Répétitions</span></Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-navy-100 hover:text-white"><ArrowLeft size={16} aria-hidden /> Accueil</Link>
        </div>
        <div className="gold-rule" />
      </header>
      <article className="mx-auto max-w-3xl px-5 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-700">Informations légales</p>
        <h1 className="mt-2 text-3xl font-semibold text-navy-950">Confidentialité et mentions légales</h1>
        <p className="mt-3 text-[15px] text-slate-700">
          La plateforme « SVTC Répétitions » est éditée par la {id.name} ({id.shortName}), {id.host}, {id.address}, {id.city} – {id.country}. Contact : {id.phones.map((p) => phoneFr(p)).join(' · ')}.
        </p>

        <Section title="1. Données collectées et finalités">
          <p><strong>Demande d&apos;inscription</strong> (formulaire de la page d&apos;accueil) : nom et téléphone du parent, adresse électronique facultative, nom, prénom, classe et établissement de l&apos;enfant, message libre. Ces données servent uniquement à rappeler la famille et à préparer l&apos;inscription.</p>
          <p><strong>Suivi scolaire</strong> (élèves inscrits) : identité de l&apos;élève et du parent, classe, présences, notes, contenus des séances, paiements. Ces données servent à organiser les répétitions, informer les parents et tenir la comptabilité du centre.</p>
          <p><strong>Comptes d&apos;accès</strong> (administration, encadreurs, parents) : identifiant, mot de passe chiffré (jamais conservé en clair), historique des connexions et des opérations sensibles pour la sécurité.</p>
        </Section>

        <Section id="cookies" title="2. Cookies, mesure d'audience et consentement">
          <p><strong>Cookie de session</strong> : un seul cookie est déposé, uniquement lorsque vous vous connectez à un espace privé (administration, encadreur, parent). Il est strictement nécessaire à la connexion, ne contient aucune donnée lisible et disparaît à la déconnexion ou à l&apos;expiration de la session. Il ne requiert pas de consentement.</p>
          <p><strong>Mesure d&apos;audience</strong> : avec votre accord donné dans le bandeau « Cookies et mesure d&apos;audience », le site compte ses visites avec un outil interne : page consultée, type d&apos;appareil et site d&apos;origine. Aucun cookie publicitaire ou de suivi n&apos;est déposé et aucune donnée n&apos;est transmise à un service tiers. Les visiteurs sont comptés par une empreinte anonyme recalculée chaque jour, qui ne permet pas de les reconnaître d&apos;un jour à l&apos;autre ; l&apos;adresse IP n&apos;est jamais enregistrée. Si vous refusez, ou si votre navigateur demande « Ne pas me pister », aucune visite n&apos;est comptée. Les statistiques sont effacées après 400 jours.</p>
          <p>Votre choix est conservé dans votre navigateur (sans cookie). Vous pouvez le modifier à tout moment :</p>
          <ManageCookiesButton className="btn btn-ghost btn-sm" label="Modifier mon choix (gérer les cookies)" />
        </Section>

        <Section title="3. Destinataires et durée de conservation">
          <p>Les données ne sont accessibles qu&apos;à l&apos;administration du centre et, pour leurs classes uniquement, aux encadreurs ; chaque parent ne voit que les informations de ses propres enfants. Elles ne sont ni vendues ni cédées. Les demandes d&apos;inscription non suivies d&apos;effet sont supprimées au plus tard à la fin de l&apos;année scolaire ; les données des élèves sont conservées le temps de la scolarité au centre puis le temps nécessaire aux obligations comptables.</p>
        </Section>

        <Section title="4. Sécurité">
          <p>Connexion chiffrée (HTTPS), mots de passe hachés, verrouillage automatique après plusieurs tentatives, contrôle d&apos;accès sur chaque page et chaque document, journal d&apos;audit, protection anti-spam du formulaire public (champ piège, jeton signé, limitation du nombre d&apos;envois).</p>
        </Section>

        <Section title="5. Vos droits">
          <p>Conformément à la loi n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel au Cameroun, vous pouvez demander l&apos;accès, la rectification ou la suppression des données vous concernant ou concernant votre enfant, en vous adressant à l&apos;administration du centre ({id.phones.map((p) => phoneFr(p)).join(', ')}) ou sur place, au {id.host}.</p>
        </Section>

        <Section title="6. Hébergement">
          <p>Application hébergée par Render Services, Inc. (San Francisco, États-Unis), centre de données de Francfort (Union européenne). Base de données PostgreSQL chiffrée au repos.</p>
        </Section>

        <p className="mt-12 text-sm text-slate-500">Dernière mise à jour : novembre 2026.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/#inscription" className="btn btn-primary">Retour au formulaire d&apos;inscription</Link>
          <Link href="/conditions" className="btn btn-ghost">Conditions générales d&apos;utilisation</Link>
        </div>
      </article>
    </main>
  );
}
