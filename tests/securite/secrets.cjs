/**
 * Liste de contrôle n° 3 : aucune clé secrète dans le code envoyé au navigateur (front-end).
 * Analyse les fichiers publics (.next/static, public/) à la recherche des valeurs des variables secrètes
 * et de motifs de secrets connus. À lancer après « npm run build » : npm run test:secrets
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const SECRET_VARS = ['DATABASE_URL', 'POSTGRES_URL', 'ADMIN_PASSWORD', 'APP_SECRET', 'ORANGE_CLIENT_ID', 'ORANGE_CLIENT_SECRET', 'TWILIO_AUTH_TOKEN', 'AT_API_KEY'];
const PATTERNS = [
  [/postgres(ql)?:\/\/[^\s"'`]+:[^\s"'`]+@/i, 'adresse de base de données avec mot de passe'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'clé privée'],
  [/\bsk_live_[0-9a-zA-Z]{10,}/, 'clé API de paiement'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'clé AWS'],
  [/process\.env\.(DATABASE_URL|ADMIN_PASSWORD|APP_SECRET)/, 'lecture de variable secrète côté navigateur'],
];
const values = SECRET_VARS.map((k) => [k, process.env[k]]).filter(([, v]) => v && v.length >= 6);
function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(js|mjs|css|html|json|txt|map|webmanifest)$/.test(e.name)) yield p;
  }
}
const dirs = [path.join(root, '.next', 'static'), path.join(root, 'public')];
if (!fs.existsSync(dirs[0])) {
  console.error('Construisez d’abord l’application (npm run build).');
  process.exit(2);
}
let files = 0;
const found = [];
for (const d of dirs) {
  for (const f of walk(d)) {
    files++;
    const text = fs.readFileSync(f, 'utf8');
    for (const [k, v] of values) if (text.includes(v)) found.push(`${path.relative(root, f)} : valeur de ${k}`);
    for (const [re, label] of PATTERNS) if (re.test(text)) found.push(`${path.relative(root, f)} : ${label}`);
  }
}
const publicVars = Object.keys(process.env).filter((k) => k.startsWith('NEXT_PUBLIC_'));
console.log(`${files} fichiers publics analysés ; ${values.length} valeur(s) secrète(s) recherchée(s) ; variables NEXT_PUBLIC_ : ${publicVars.length ? publicVars.join(', ') : 'aucune'}`);
if (found.length) {
  console.log('✗ Secrets exposés :');
  for (const x of found) console.log('  - ' + x);
  process.exit(1);
}
console.log('✓ Aucune clé secrète dans le code envoyé au navigateur.');
