import Link from 'next/link';
import { asc, desc, eq } from 'drizzle-orm';
import { Inbox, Phone, MessageCircle, PhoneCall, UserPlus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { db } from '@/db';
import { classes, enrollmentRequests, parents, students } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { refData } from '@/lib/queries';
import { dateTimeFr, num, phoneFr } from '@/lib/format';
import { whatsappLink } from '@/lib/sms';
import { Badge, Card, Empty, PageHeader, TableWrap } from '@/components/ui';
import { ActionButton, ActionForm, AutoSubmitSelect, Modal, SubmitButton } from '@/components/client/forms';
import { StudentForm } from '@/components/admin/student-form';
import { deleteRequest, markRequestContacted, updateRequest } from '@/app/actions/requests';

export const metadata = { title: "Demandes d'inscription" };

const STATUS: Record<string, { label: string; tone: 'gold' | 'blue' | 'green' | 'slate' }> = {
  NOUVELLE: { label: 'Nouvelle', tone: 'gold' },
  CONTACTEE: { label: 'Contactée', tone: 'blue' },
  INSCRITE: { label: 'Inscrite', tone: 'green' },
  REFUSEE: { label: 'Sans suite', tone: 'slate' },
};

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const sp = await searchParams;
  const filter = sp.statut && STATUS[sp.statut] ? sp.statut : '';
  const [s, ref, rows, parentList] = await Promise.all([
    getSettings(),
    refData(),
    db
      .select({
        r: enrollmentRequests,
        className: classes.name,
        studentFirst: students.firstName,
        studentLast: students.lastName,
      })
      .from(enrollmentRequests)
      .leftJoin(classes, eq(classes.id, enrollmentRequests.classId))
      .leftJoin(students, eq(students.id, enrollmentRequests.studentId))
      .orderBy(desc(enrollmentRequests.createdAt))
      .limit(500),
    db.select({ id: parents.id, fullName: parents.fullName, phone: parents.phone }).from(parents).orderBy(asc(parents.fullName)),
  ]);
  const counts = Object.fromEntries(Object.keys(STATUS).map((k) => [k, rows.filter((x) => x.r.status === k).length]));
  const list = filter ? rows.filter((x) => x.r.status === filter) : rows;
  const classOpts = ref.classes.filter((c) => c.isActive).map((c) => ({ id: c.id, name: c.name }));
  const center = s.identity.shortName || 'SVTC';

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Pilotage"
        title="Demandes d'inscription"
        subtitle={<>Reçues par le formulaire « Inscrire mon enfant » de la page d&apos;accueil · {num(counts.NOUVELLE)} nouvelle(s) à traiter</>}
        actions={<a href="/#inscription" target="_blank" className="btn btn-ghost"><ExternalLink size={17} /> Voir le formulaire public</a>}
      />

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/demandes" className={`chip ${!filter ? 'chip-on' : ''}`}>Toutes ({rows.length})</Link>
        {Object.entries(STATUS).map(([k, v]) => (
          <Link key={k} href={`/admin/demandes?statut=${k}`} className={`chip ${filter === k ? 'chip-on' : ''}`}>{v.label} ({counts[k]})</Link>
        ))}
      </div>

      <Card pad={false}>
        {list.length === 0 ? (
          <Empty icon={<Inbox />} title="Aucune demande" text="Les demandes envoyées par les parents depuis la page d'accueil apparaissent ici, avec leur numéro pour les rappeler." />
        ) : (
          <TableWrap>
            <table className="tbl">
              <thead><tr><th>Reçue le</th><th>Enfant</th><th>Parent</th><th className="hidden lg:table-cell">Message</th><th>Statut</th><th className="w-44" /></tr></thead>
              <tbody>
                {list.map(({ r, className, studentFirst, studentLast }) => {
                  const st = STATUS[r.status] ?? STATUS.NOUVELLE;
                  const wa = whatsappLink(r.phone, `Bonjour ${r.parentName}, ici le ${center}. Nous avons bien reçu votre demande d'inscription pour ${r.childFirstName} ${r.childLastName}.`);
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap text-sm">{dateTimeFr(r.createdAt)}</td>
                      <td>
                        <p className="font-medium text-navy-950">{r.childLastName} {r.childFirstName}</p>
                        <p className="text-xs text-slate-500">{className ?? 'Classe non précisée'}{r.school ? ` · ${r.school}` : ''}</p>
                        {r.studentId && <Link href={`/admin/eleves/${r.studentId}`} className="text-xs font-medium text-royal-700 hover:underline">Fiche élève : {studentLast} {studentFirst}</Link>}
                      </td>
                      <td>
                        <p className="text-sm">{r.parentName}</p>
                        <a href={`tel:${r.phone}`} className="text-xs text-slate-600 hover:text-royal-700">{phoneFr(r.phone)}</a>
                        {r.email && <p className="text-xs text-slate-500">{r.email}</p>}
                      </td>
                      <td className="hidden max-w-xs lg:table-cell">
                        <p className="line-clamp-3 text-sm text-slate-700">{r.message || '—'}</p>
                        {r.notes && <p className="mt-1 text-xs italic text-slate-500">Note : {r.notes}</p>}
                      </td>
                      <td><Badge tone={st.tone}>{st.label}</Badge></td>
                      <td>
                        <div className="flex flex-wrap justify-end gap-0.5">
                          <a href={`tel:${r.phone}`} className="btn-icon" title="Appeler" aria-label={`Appeler ${r.parentName}`}><Phone size={16} /></a>
                          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-icon hover:text-emerald-700" title="WhatsApp" aria-label={`Écrire à ${r.parentName} sur WhatsApp`}><MessageCircle size={16} /></a>
                          {r.status === 'NOUVELLE' && (
                            <ActionButton action={markRequestContacted.bind(null, r.id)} className="btn-icon" title="Marquer contactée"><PhoneCall size={16} /></ActionButton>
                          )}
                          {r.status !== 'INSCRITE' && (
                            <Modal title={`Inscrire ${r.childFirstName} ${r.childLastName}`} subtitle="Fiche préremplie depuis la demande : vérifiez puis validez" size="lg" trigger={<button className="btn-icon hover:text-emerald-700" title="Inscrire l'élève" aria-label="Inscrire l'élève"><UserPlus size={16} /></button>}>
                              <StudentForm classes={classOpts} parents={parentList} prefill={{ lastName: r.childLastName, firstName: r.childFirstName, classId: r.classId, school: r.school, parentName: r.parentName, parentPhone: r.phone, requestId: r.id }} />
                            </Modal>
                          )}
                          <Modal title="Suivi de la demande" trigger={<button className="btn-icon" title="Modifier le statut" aria-label="Modifier le statut"><Pencil size={16} /></button>}>
                            <ActionForm action={updateRequest.bind(null, r.id)} reset={false} className="grid gap-4">
                              <label><span className="label">Statut</span>
                                <select name="status" className="input" defaultValue={r.status}>
                                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                              </label>
                              <label><span className="label">Note interne</span><textarea name="notes" className="input" maxLength={600} defaultValue={r.notes ?? ''} placeholder="Ex. : rappeler samedi, vient le 12/11…" /></label>
                              <SubmitButton>Enregistrer</SubmitButton>
                            </ActionForm>
                          </Modal>
                          <ActionButton action={deleteRequest.bind(null, r.id)} confirm={`Supprimer la demande de ${r.parentName} ?`} className="btn-icon hover:text-rose-600" title="Supprimer"><Trash2 size={16} /></ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
      <p className="text-xs text-slate-500">Protection anti-spam active : champ piège invisible, jeton horodaté signé, délai minimal de saisie et limite de 5 demandes par heure et par adresse IP. Les données sont conservées pour le seul traitement de l&apos;inscription.</p>
    </div>
  );
}
