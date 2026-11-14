'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { enrollmentRequests, classes } from '@/db/schema';
import { clientInfo } from '@/lib/auth';
import { audit, rateLimit } from '@/lib/audit';
import { formObject, safe, UserError, zs, type ActionResult } from '@/lib/action';
import { checkFormToken } from '@/lib/antispam';
import { isValidCmPhone, normalizePhone } from '@/lib/format';

const schema = z.object({
  parentName: zs.text('Nom du parent', 100),
  phone: z.string({ error: 'Téléphone : obligatoire.' }).transform((v) => normalizePhone(v)).refine((v) => isValidCmPhone(v), 'Téléphone : numéro camerounais à 9 chiffres attendu (6XX XX XX XX).'),
  email: z.union([z.literal(''), z.email('Adresse e-mail invalide.')]).optional(),
  childLastName: zs.text("Nom de l'enfant", 60),
  childFirstName: zs.text("Prénom(s) de l'enfant", 80),
  classId: z.coerce.number().int().positive().optional(),
  school: zs.optText(120),
  message: zs.optText(600),
  consent: z.literal('on', { error: 'Merci d’accepter d’être recontacté(e) par le centre.' }),
});

const THANKS = 'Merci ! Votre demande est bien reçue : le centre vous rappelle très vite pour finaliser l’inscription.';

/** Demande d'inscription depuis le site public : champ piège, jeton signé, limite par IP, validation stricte. */
export async function submitEnrollmentRequest(fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    if (String(fd.get('website') ?? '').trim() !== '') return { ok: true, message: THANKS }; // robot : ignoré silencieusement
    const tk = checkFormToken(String(fd.get('token') ?? ''));
    if (tk === 'trop-rapide') throw new UserError('Envoi trop rapide : vérifiez vos informations puis renvoyez le formulaire.');
    if (tk === 'invalide') throw new UserError('Le formulaire a expiré : rechargez la page puis réessayez.');
    const { ip } = await clientInfo();
    const rl = await rateLimit(`inscription:${ip}`, 5, 3600);
    if (!rl.ok) throw new UserError('Trop de demandes envoyées depuis cet appareil. Réessayez plus tard ou appelez le centre.');
    const d = schema.parse(formObject(fd));
    if (d.classId) {
      const [c] = await db.select({ id: classes.id }).from(classes).where(eq(classes.id, d.classId));
      if (!c) throw new UserError('Classe inconnue.');
    }
    const [row] = await db.insert(enrollmentRequests).values({
      parentName: d.parentName, phone: d.phone, email: d.email || null, childLastName: d.childLastName.toUpperCase(), childFirstName: d.childFirstName,
      classId: d.classId ?? null, school: d.school ?? null, message: d.message ?? null,
    }).returning({ id: enrollmentRequests.id });
    await audit(null, 'DEMANDE_INSCRIPTION_RECUE', { entity: 'demande', entityId: row.id });
    revalidatePath('/admin/demandes');
    revalidatePath('/admin');
    return { ok: true, message: THANKS };
  });
}
