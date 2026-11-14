'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { enrollmentRequests } from '@/db/schema';
import { assertRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { safe, UserError, type ActionResult } from '@/lib/action';

export async function updateRequest(id: number, fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const status = z.enum(['NOUVELLE', 'CONTACTEE', 'INSCRITE', 'REFUSEE']).parse(fd.get('status'));
    const notes = String(fd.get('notes') ?? '').trim().slice(0, 600) || null;
    const r = await db.update(enrollmentRequests).set({ status, notes, handledBy: me.id, handledAt: new Date() }).where(eq(enrollmentRequests.id, id)).returning({ id: enrollmentRequests.id });
    if (!r.length) throw new UserError('Demande introuvable.');
    await audit(me, 'DEMANDE_INSCRIPTION_TRAITEE', { entity: 'demande', entityId: id, details: { status } });
    revalidatePath('/admin/demandes');
    revalidatePath('/admin');
    return { ok: true, message: 'Demande mise à jour.' };
  });
}

export async function markRequestContacted(id: number): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    await db.update(enrollmentRequests).set({ status: 'CONTACTEE', handledBy: me.id, handledAt: new Date() }).where(eq(enrollmentRequests.id, id));
    revalidatePath('/admin/demandes');
    revalidatePath('/admin');
    return { ok: true, message: 'Demande marquée « contactée ».' };
  });
}

export async function deleteRequest(id: number): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    await db.delete(enrollmentRequests).where(eq(enrollmentRequests.id, id));
    await audit(me, 'DEMANDE_INSCRIPTION_SUPPRIMEE', { entity: 'demande', entityId: id });
    revalidatePath('/admin/demandes');
    return { ok: true, message: 'Demande supprimée.' };
  });
}
