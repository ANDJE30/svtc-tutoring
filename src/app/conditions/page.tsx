import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/brand';
import { publicSettings, logoUrl } from '@/lib/public-settings';
import { phoneFr } from '@/lib/format';

export const metadata = {
  title: 'Conditions générales d’utilisation',
  description: 'Conditions générales d’utilisation de la plateforme SVTC Répétitions et conditions d’inscription aux cours de répétitions en informatique de la Silicon Valley Training Center (Yaoundé).',
  alternates: { canonical: '/conditions' },
};

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-6">
      <h2 className="text-xl font-semibold text-navy-950">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

export default async function TermsPage() {
  const s = await publicSettings();
  const id = s.identity;
  const phones = id.phones.map((p) => phoneFr(p)).join(' · ');
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
        <h1 className="mt-2 text-3xl font-semibold text-navy-950">Conditions générales d’utilisation</h1>
        <p className="mt-3 text-[15px] text-slate-700">
          Les présentes conditions régissent l’utilisation de la plateforme « SVTC Répétitions » éditée par la {id.name} ({id.shortName}), {id.host}, {id.address}, {id.city} – {id.country}
          (contact : {phones}). En utilisant le site ou un espace personnel, vous acceptez ces conditions.
        </p>
        <nav aria-label="Sommaire" className="mt-6 rounded-2xl bg-navy-50/60 p-4 text-sm">
          <ol className="grid gap-1 sm:grid-cols-2">
            {[['objet', '1. Objet'], ['acces', '2. Accès et comptes'], ['inscription', '3. Inscription aux répétitions'], ['paiements', '4. Frais et paiements'], ['seances', '5. Séances et suivi'], ['usage', '6. Bon usage de la plateforme'], ['propriete', '7. Propriété intellectuelle'], ['donnees', '8. Données personnelles et cookies'], ['responsabilite', '9. Disponibilité et responsabilité'], ['modification', '10. Modification et droit applicable']].map(([a, l]) => (
              <li key={a}><a href={`#${a}`} className="text-royal-700 underline-offset-4 hover:underline">{l}</a></li>
            ))}
          </ol>
        </nav>

        <Section id="objet" title="1. Objet">
          <p>La plateforme permet de présenter les cours de répétitions en informatique du centre, de recevoir les demandes d’inscription et de gérer l’activité : planning, séances, présences, notes, documents pédagogiques, paiements et communication entre l’administration, les encadreurs et les parents.</p>
        </Section>

        <Section id="acces" title="2. Accès et comptes">
          <p>Le site public est accessible librement. Les espaces <strong>administration</strong>, <strong>encadreur</strong> et <strong>parent</strong> sont réservés aux personnes auxquelles le centre a remis des identifiants. Chaque compte est personnel : son titulaire garde son mot de passe confidentiel, le modifie à la première connexion si le centre le demande et signale sans délai toute utilisation suspecte.</p>
          <p>Le centre peut suspendre ou désactiver un compte en cas de départ de l’élève ou de l’encadreur, d’usage abusif ou de risque pour la sécurité. Un compte est verrouillé temporairement après plusieurs mots de passe erronés.</p>
        </Section>

        <Section id="inscription" title="3. Inscription aux répétitions">
          <p>Le formulaire « Inscrire mon enfant » constitue une <strong>demande</strong> : l’inscription n’est définitive qu’après confirmation par le centre (classe, horaires, frais) et enregistrement de l’élève. Le parent s’engage à fournir des informations exactes et à signaler tout changement (téléphone, classe, établissement).</p>
        </Section>

        <Section id="paiements" title="4. Frais et paiements">
          <p>Les frais d’inscription et les mensualités sont ceux communiqués par le centre pour la classe de l’élève. Les paiements se font au centre ou par Mobile Money (MTN, Orange) ; aucun paiement n’est demandé sur le site. Chaque paiement donne lieu à un <strong>reçu numéroté</strong> portant un code et un QR code d’authenticité, consultable dans l’espace parent. Pour un paiement Mobile Money, la référence de la transaction est obligatoire.</p>
          <p>La situation du compte de l’élève (montant payé, reste à payer, mois réglés) est indiquée dans l’espace parent. Les modalités particulières (réductions, échéancier, remboursement) sont celles convenues avec le centre lors de l’inscription.</p>
        </Section>

        <Section id="seances" title="5. Séances et suivi">
          <p>Le planning des séances est publié dans les espaces encadreur et parent ; il peut être modifié (jour férié, examen, remplacement d’un encadreur) et les familles en sont informées par message. Les présences, les notes et les états de suivi sont établis par les encadreurs et l’administration ; ils sont communiqués au seul parent de l’élève.</p>
        </Section>

        <Section id="usage" title="6. Bon usage de la plateforme">
          <p>Il est interdit de tenter d’accéder à un espace ou à des données qui ne vous sont pas destinés, de perturber le fonctionnement du site, d’envoyer des demandes automatisées ou trompeuses, ou de déposer des fichiers qui ne sont pas des documents pédagogiques légitimes. Les opérations sensibles sont enregistrées dans un journal d’audit.</p>
        </Section>

        <Section id="propriete" title="7. Propriété intellectuelle">
          <p>Le nom, le logo et les supports de la {id.shortName}, ainsi que les fiches de TD et documents pédagogiques déposés sur la plateforme, sont réservés à l’usage personnel des élèves inscrits et de leurs parents. Toute reproduction ou diffusion en dehors de ce cadre nécessite l’accord du centre.</p>
        </Section>

        <Section id="donnees" title="8. Données personnelles et cookies">
          <p>Le traitement des données personnelles, le cookie de session et la mesure d’audience sans cookie sont décrits dans la <Link href="/confidentialite" className="font-medium text-royal-700 underline">politique de confidentialité</Link>, conformément à la loi n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel au Cameroun. Vous pouvez modifier à tout moment votre choix concernant la mesure d’audience depuis le lien « Gérer les cookies » en bas des pages.</p>
        </Section>

        <Section id="responsabilite" title="9. Disponibilité et responsabilité">
          <p>Le centre s’efforce d’assurer l’accès au site 24 h/24, sans pouvoir le garantir en cas de maintenance, de mise à jour ou d’incident de l’hébergeur ou du réseau. Les informations affichées (planning, notes, soldes) peuvent être corrigées par le centre ; en cas de différence, les registres du centre font foi.</p>
        </Section>

        <Section id="modification" title="10. Modification et droit applicable">
          <p>Le centre peut modifier les présentes conditions ; la version en vigueur est celle publiée sur cette page. Elles sont soumises au droit camerounais. En cas de difficulté, contactez d’abord le centre ({phones}) afin de rechercher une solution amiable.</p>
        </Section>

        <p className="mt-12 text-sm text-slate-500">Dernière mise à jour : novembre 2026.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/#inscription" className="btn btn-primary">Inscrire mon enfant</Link>
          <Link href="/confidentialite" className="btn btn-ghost">Politique de confidentialité</Link>
        </div>
      </article>
    </main>
  );
}
