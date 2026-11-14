import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Clé de signature : APP_SECRET si défini, sinon dérivée de la chaîne de connexion (jamais exposée). */
function key() {
  return process.env.APP_SECRET || `svtc:${process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? 'local'}`;
}

/** Jeton de formulaire horodaté et signé (piège à robots : envoi trop rapide ou jeton falsifié). */
export function formToken(now = Date.now()): string {
  const sig = createHmac('sha256', key()).update(`form:${now}`).digest('base64url').slice(0, 22);
  return `${now}.${sig}`;
}

export function checkFormToken(token: string | null | undefined, minMs = 3000, maxMs = 24 * 3600_000): 'ok' | 'trop-rapide' | 'invalide' {
  if (!token) return 'invalide';
  const [ts, sig] = token.split('.');
  const t = Number(ts);
  if (!Number.isFinite(t) || !sig) return 'invalide';
  const expected = createHmac('sha256', key()).update(`form:${t}`).digest('base64url').slice(0, 22);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return 'invalide';
  const age = Date.now() - t;
  if (age < minMs) return 'trop-rapide';
  if (age > maxMs) return 'invalide';
  return 'ok';
}

/** Empreinte quotidienne non réversible d'un visiteur (aucun cookie, aucune adresse IP conservée). */
export function visitorFingerprint(day: string, ip: string, ua: string): string {
  return createHmac('sha256', key()).update(`v:${day}:${ip}:${ua}`).digest('base64url').slice(0, 16);
}
