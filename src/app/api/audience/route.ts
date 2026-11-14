import { NextResponse } from 'next/server';
import { lt } from 'drizzle-orm';
import { db } from '@/db';
import { pageViews } from '@/db/schema';
import { clientInfo } from '@/lib/auth';
import { rateLimit } from '@/lib/audit';
import { visitorFingerprint } from '@/lib/antispam';
import { addDays, todayISO } from '@/lib/time';

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget|python|axios|httpclient/i;

function section(path: string) {
  if (path.startsWith('/admin')) return 'ADMIN';
  if (path.startsWith('/encadreur')) return 'ENCADREUR';
  if (path.startsWith('/parent')) return 'PARENT';
  return 'PUBLIC';
}

function device(ua: string) {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return 'TABLETTE';
  if (/mobi|iphone|android/i.test(ua)) return 'MOBILE';
  return 'ORDINATEUR';
}

/** Mesure d'audience interne, sans cookie : une ligne par page vue, visiteur anonymisé chaque jour. */
export async function POST(req: Request) {
  try {
    const { ip, ua } = await clientInfo();
    if (!ua || BOT.test(ua)) return new NextResponse(null, { status: 204 });
    const origin = req.headers.get('origin');
    if (origin && new URL(origin).host !== (req.headers.get('x-forwarded-host') ?? req.headers.get('host'))) return new NextResponse(null, { status: 204 });
    if (!(await rateLimit(`audience:${ip}`, 120, 600)).ok) return new NextResponse(null, { status: 204 });
    const raw = (await req.text()).slice(0, 1000);
    const body = JSON.parse(raw) as { p?: unknown; r?: unknown };
    const path = typeof body.p === 'string' ? body.p.split('?')[0].slice(0, 120) : '';
    if (!path.startsWith('/') || path.startsWith('/api') || path.startsWith('/_next')) return new NextResponse(null, { status: 204 });
    let source: string | null = null;
    if (typeof body.r === 'string' && body.r) {
      try {
        const h = new URL(body.r).hostname.replace(/^www\./, '');
        const self = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').split(':')[0];
        if (h && h !== self) source = h.slice(0, 80);
      } catch {}
    }
    const day = todayISO();
    // Identifiants numériques remplacés pour regrouper les pages de même nature (/admin/eleves/12 → /admin/eleves/:id)
    const normalized = path.replace(/\/\d+(?=\/|$)/g, '/:id').replace(/\/[A-Z0-9]{8,16}$/, '/:code');
    await db.insert(pageViews).values({ day, path: normalized, section: section(path), visitor: visitorFingerprint(day, ip, ua), device: device(ua), source });
    if (Math.random() < 0.01) await db.delete(pageViews).where(lt(pageViews.day, addDays(day, -400)));
  } catch {
    // la mesure d'audience ne doit jamais gêner la navigation
  }
  return new NextResponse(null, { status: 204 });
}
