// Applique les migrations SQL (dossier drizzle/) sur la base DATABASE_URL. Exécuté automatiquement avant chaque build.
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (url) {
  // Paramètres réservés aux clients libpq (ex. channel_binding de Neon) : à ne pas transmettre au serveur
  const u = new URL(url);
  for (const k of ['channel_binding', 'pgbouncer', 'connect_timeout', 'pool_timeout', 'schema']) u.searchParams.delete(k);
  url = u.toString();
}
if (!url) {
  console.warn('[migrate] DATABASE_URL absente : migrations ignorées (configurez la base avant la mise en production).');
  process.exit(0);
}
const host = new URL(url).hostname;
const local = ['localhost', '127.0.0.1'].includes(host) || !host.includes('.') || /sslmode=disable/.test(url);
const sql = postgres(url, { max: 1, prepare: false, ssl: local ? false : 'require', onnotice: () => {} });
const folder = new URL('../drizzle', import.meta.url).pathname;

/**
 * Garde-fou de mise à jour : les migrations en attente ne doivent jamais détruire de données (DROP TABLE, DROP COLUMN, TRUNCATE, DELETE…).
 * Si c'est le cas, la construction s'arrête et la version en ligne reste inchangée, données comprises.
 * Pour une suppression voulue et sauvegardée au préalable : ALLOW_DESTRUCTIVE_MIGRATIONS=1.
 */
async function guardDestructiveMigrations() {
  const journal = JSON.parse(readFileSync(join(folder, 'meta', '_journal.json'), 'utf8'));
  let lastApplied = -1;
  try {
    const rows = await sql`select max(created_at)::bigint as last from drizzle.__drizzle_migrations`;
    lastApplied = rows[0]?.last == null ? -1 : Number(rows[0].last);
  } catch (e) {
    if (e.code === '42P01' || e.code === '3F000') return; // base neuve (pas encore de journal des migrations) : aucune donnée à protéger
    throw e;
  }
  if (lastApplied < 0) return;
  const DESTRUCTIVE = /\b(DROP\s+TABLE|DROP\s+SCHEMA|DROP\s+COLUMN|TRUNCATE|DELETE\s+FROM)\b[^;]*/gi;
  const found = [];
  for (const e of journal.entries.filter((x) => x.when > lastApplied)) {
    const text = readFileSync(join(folder, `${e.tag}.sql`), 'utf8');
    for (const m of text.matchAll(DESTRUCTIVE)) found.push(`${e.tag} : ${m[0].trim().slice(0, 120)}`);
  }
  const pending = journal.entries.filter((x) => x.when > lastApplied).map((x) => x.tag);
  console.log(`[migrate] migrations en attente : ${pending.length ? pending.join(', ') : 'aucune'}`);
  if (found.length && process.env.ALLOW_DESTRUCTIVE_MIGRATIONS !== '1') {
    console.error('[migrate] REFUS : ces migrations supprimeraient des données existantes :');
    for (const f of found) console.error('   - ' + f);
    console.error('[migrate] Sauvegardez la base puis relancez avec ALLOW_DESTRUCTIVE_MIGRATIONS=1 si la suppression est voulue.');
    throw new Error('migration destructive bloquée');
  }
}

try {
  await guardDestructiveMigrations();
  await migrate(drizzle(sql), { migrationsFolder: folder });
  console.log('[migrate] base de données à jour');
} catch (e) {
  console.error('[migrate] échec :', e.message, e.cause?.message ?? '');
  process.exitCode = 1;
} finally {
  await sql.end();
}
