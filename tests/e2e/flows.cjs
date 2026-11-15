/**
 * Tests de bout en bout des parcours principaux (administrateur, encadreur, parent) et des contrôles de sécurité.
 * Prérequis : application démarrée (BASE, défaut http://localhost:3100) avec le jeu de démonstration
 *   npx tsx --conditions=react-server scripts/seed-demo.ts --reset
 */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:3100';
const ADMIN = { user: process.env.ADMIN_USER || 'admin', pass: process.env.ADMIN_PASS || 'Admin@2026' };
const FIX = path.join(__dirname, 'fixtures');

let passed = 0;
let failed = 0;
async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${String(e.message).split('\n')[0]}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function toast(page, re, timeout = 20000) {
  const loc = page.locator('[data-sonner-toast]').filter({ hasText: re }).first();
  await loc.waitFor({ timeout });
  return loc.innerText();
}
async function login(page, portal, user, pass) {
  await page.goto(`${BASE}/${portal}/connexion`);
  await page.fill('#username', user);
  await page.fill('#password', pass);
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith('/connexion'), { timeout: 30000 }), page.click('button[type=submit]')]);
}
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date());

(async () => {
  const browser = await chromium.launch();
  // Choix du bandeau cookies déjà fait (« Accepter ») pour tous les contextes, sauf le test dédié au bandeau
  const freshContext = browser.newContext.bind(browser);
  browser.newContext = async (o) => {
    const c = await freshContext(o);
    await c.addInitScript(() => { try { localStorage.setItem('svtc_consentement', 'accepte'); } catch {} });
    return c;
  };
  const ctxA = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const admin = await ctxA.newPage();
  admin.on('dialog', (d) => d.accept());
  let parentPassword = '';

  console.log('Site public');
  const UA = 'Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
  const ctxV = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA, isMobile: true, hasTouch: true });
  const visitor = await ctxV.newPage();
  const stamp = String(Date.now()).slice(-6);
  await step('accueil : un seul appel à l’action et formulaire protégé', async () => {
    await visitor.goto(`${BASE}/`);
    assert((await visitor.locator('a[href="#inscription"]').count()) === 1, 'un seul lien vers le formulaire attendu');
    assert((await visitor.locator('main a.btn').count()) === 1, 'un seul bouton d’action attendu dans la page');
    assert((await visitor.locator('input[name=website]').count()) === 1, 'champ piège absent');
    assert(/^\d+\.[\w-]+$/.test(await visitor.locator('input[name=token]').inputValue()), 'jeton anti-spam absent');
    const overflow = await visitor.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 0, `débordement horizontal sur mobile : ${overflow}px`);
  });
  await step('formulaire : validation des champs dans le navigateur', async () => {
    const valid = await visitor.evaluate(() => document.querySelector('#inscription form').checkValidity());
    assert(!valid, 'un formulaire vide ne doit pas être valide');
    await visitor.fill('input[name=phone]', '12345');
    assert(await visitor.locator('input[name=phone]').evaluate((e) => e.validity.patternMismatch), 'numéro invalide accepté');
    await visitor.fill('input[name=phone]', '699 12 34 56');
    assert(!(await visitor.locator('input[name=phone]').evaluate((e) => e.validity.patternMismatch)), 'numéro valide refusé');
  });
  await step('formulaire : un robot qui remplit le champ piège est ignoré', async () => {
    const r = await visitor.evaluate(async () => {
      const f = document.querySelector('#inscription form');
      return { hidden: getComputedStyle(f.querySelector('input[name=website]')).visibility, inView: f.querySelector('input[name=website]').getBoundingClientRect().right > 0 };
    });
    assert(!r.inView, 'le champ piège doit être hors de l’écran');
    const bot = await ctxV.newPage();
    await bot.goto(`${BASE}/#inscription`);
    await bot.fill('input[name=parentName]', `ROBOT${stamp}`);
    await bot.fill('input[name=phone]', '677000000');
    await bot.fill('input[name=childLastName]', `ROBOT${stamp}`);
    await bot.fill('input[name=childFirstName]', 'Spam');
    await bot.check('input[name=consent]');
    await bot.locator('input[name=website]').evaluate((e) => { e.value = 'https://spam.example'; });
    await bot.waitForTimeout(3200);
    await bot.click('#inscription button[type=submit]');
    await bot.getByText('Demande envoyée').waitFor({ timeout: 20000 }); // réponse identique : le robot ne sait pas qu'il est filtré
    await bot.close();
  });
  await step('formulaire : demande d’inscription envoyée', async () => {
    await visitor.fill('input[name=parentName]', `Mme VISITEUSE ${stamp}`);
    await visitor.fill('input[name=email]', 'parent@exemple.cm');
    await visitor.fill('input[name=childLastName]', `ENFANT${stamp}`);
    await visitor.fill('input[name=childFirstName]', 'Prospère');
    await visitor.selectOption('select[name=classId]', { index: 1 });
    await visitor.fill('input[name=school]', 'Lycée de Biyem-Assi');
    await visitor.check('input[name=consent]');
    await visitor.waitForTimeout(3200); // délai minimal de saisie exigé par la protection anti-spam
    await visitor.click('#inscription button[type=submit]');
    await visitor.getByText('Demande envoyée').waitFor({ timeout: 20000 });
  });
  await step('page 404 personnalisée, robots.txt et sitemap.xml', async () => {
    const r = await visitor.goto(`${BASE}/page-qui-n-existe-pas`);
    assert(r.status() === 404, `statut ${r.status()}`);
    assert(/introuvable/i.test(await visitor.locator('h1').innerText()), 'titre 404');
    assert((await visitor.locator('a[href="/"]').count()) >= 1, 'lien de retour');
    const robots = await visitor.request.get(`${BASE}/robots.txt`);
    assert(robots.ok() && /Disallow: \/admin/.test(await robots.text()), 'robots.txt');
    const sm = await visitor.request.get(`${BASE}/sitemap.xml`);
    assert(sm.ok() && /<urlset/.test(await sm.text()), 'sitemap.xml');
    const priv = await visitor.goto(`${BASE}/confidentialite`);
    assert(priv.ok(), 'confidentialité');
  });
  await step('conditions générales, favicon et liens légaux', async () => {
    const c = await visitor.goto(`${BASE}/conditions`);
    assert(c.ok() && /Conditions générales/.test(await visitor.locator('h1').innerText()), 'conditions');
    assert((await visitor.request.get(`${BASE}/favicon.ico`)).ok(), 'favicon.ico');
    await visitor.goto(`${BASE}/`);
    for (const href of ['/confidentialite', '/conditions']) assert((await visitor.locator(`footer a[href="${href}"]`).count()) === 1, `lien ${href} absent du pied de page`);
    assert(/\/conditions/.test(await (await visitor.request.get(`${BASE}/sitemap.xml`)).text()), 'conditions absentes du sitemap');
  });
  await step('HTTPS forcé : une requête HTTP est redirigée vers HTTPS', async () => {
    const u = new URL(BASE);
    const res = await new Promise((ok, ko) => http.get({ host: u.hostname, port: u.port, path: '/connexion?x=1', headers: { Host: 'svtc-test.example', 'X-Forwarded-Proto': 'http' } }, ok).on('error', ko));
    res.resume();
    assert(res.statusCode === 308 && res.headers.location === 'https://svtc-test.example/connexion?x=1', `statut ${res.statusCode} ${res.headers.location}`);
  });
  await step('bandeau cookies : refus mémorisé, aucune mesure d’audience, choix modifiable', async () => {
    const ctx = await freshContext({ viewport: { width: 390, height: 844 }, userAgent: UA, isMobile: true });
    const pg = await ctx.newPage();
    let beacons = 0;
    pg.on('request', (r) => { if (r.url().endsWith('/api/audience')) beacons++; });
    await pg.goto(`${BASE}/`);
    const banner = pg.getByRole('dialog', { name: /Cookies et mesure d’audience/ });
    await banner.waitFor({ timeout: 15000 });
    await banner.getByRole('button', { name: 'Refuser' }).click();
    await banner.waitFor({ state: 'detached' });
    await pg.reload();
    await pg.waitForTimeout(1500);
    assert(!(await pg.getByRole('dialog', { name: /Cookies/ }).count()), 'le bandeau réapparaît après un refus');
    assert(beacons === 0, `mesure d’audience envoyée malgré le refus (${beacons})`);
    await pg.locator('footer').getByRole('button', { name: 'Gérer les cookies' }).click();
    await pg.getByRole('dialog', { name: /Cookies/ }).getByRole('button', { name: 'Accepter' }).click();
    await pg.waitForTimeout(800);
    assert(beacons === 1, `la visite doit être comptée après acceptation (${beacons})`);
    await ctx.close();
  });
  await step('mesure d’audience : visite enregistrée sans cookie', async () => {
    const r = await visitor.request.post(`${BASE}/api/audience`, { data: JSON.stringify({ p: '/', r: 'https://www.facebook.com/' }), headers: { origin: BASE, 'content-type': 'text/plain', 'user-agent': UA } });
    assert(r.status() === 204, `statut ${r.status()}`);
    assert(!r.headers()['set-cookie'], 'aucun cookie attendu');
  });

  console.log('Administrateur');
  await step('connexion administrateur', async () => login(admin, 'admin', ADMIN.user, ADMIN.pass));
  await step('demande d’inscription reçue puis élève inscrit depuis la demande', async () => {
    await admin.goto(`${BASE}/admin/demandes?statut=NOUVELLE`);
    const row = admin.locator('tr', { hasText: `ENFANT${stamp}` });
    await row.waitFor({ timeout: 15000 });
    assert(!(await admin.locator('tr', { hasText: 'ROBOT' }).count()), 'demande du robot enregistrée');
    await row.locator('button[aria-label="Inscrire l\'élève"]').click();
    const dlg = admin.locator('dialog[open]');
    assert((await dlg.locator('input[name=lastName]').inputValue()) === `ENFANT${stamp}`, 'nom non prérempli');
    assert(/699/.test(await dlg.locator('input[name=parentPhone]').inputValue()), 'téléphone non prérempli');
    await dlg.locator('button[type=submit]').click();
    await toast(admin, /inscrit|enregistr/i);
    await admin.goto(`${BASE}/admin/demandes?statut=INSCRITE`);
    await admin.locator('tr', { hasText: `ENFANT${stamp}` }).waitFor({ timeout: 15000 });
  });
  await step('audience du site affichée', async () => {
    await admin.goto(`${BASE}/admin/audience?jours=7`);
    assert(/Pages vues/.test(await admin.locator('main').innerText()), 'statistiques absentes');
    assert(/facebook\.com/.test(await admin.locator('main').innerText()), 'provenance non enregistrée');
  });
  await step('mise à jour de l’identité du centre', async () => {
    await admin.goto(`${BASE}/admin/parametres`);
    await admin.fill('input[name=directorName]', 'M. NDJOCK Paul');
    await admin.getByRole('button', { name: /Enregistrer l.identité/ }).click();
    await toast(admin, /Identité du centre enregistrée/);
  });
  await step('ajout d’une classe (Seconde TI)', async () => {
    await admin.goto(`${BASE}/admin/classes`);
    await admin.getByRole('button', { name: 'Ajouter une classe' }).click();
    const dlg = admin.locator('dialog[open]');
    await dlg.locator('input[name=code]').fill('STI');
    await dlg.locator('input[name=name]').fill('Seconde TI');
    await dlg.locator('input[name=monthlyFee]').fill('9000');
    await dlg.getByRole('button', { name: 'Ajouter la classe' }).click();
    await toast(admin, /Classe Seconde TI ajoutée/);
  });
  await step('inscription d’un élève avec création automatique du parent', async () => {
    await admin.goto(`${BASE}/admin/eleves`);
    await admin.getByRole('button', { name: 'Inscrire un élève' }).click();
    const dlg = admin.locator('dialog[open]');
    await dlg.locator('input[name=lastName]').fill('TESTEUR');
    await dlg.locator('input[name=firstName]').fill('Junior');
    await dlg.locator('select[name=classId]').selectOption({ label: 'Seconde TI' });
    await dlg.locator('input[name=parentName]').fill('M. TESTEUR Albert');
    await dlg.locator('input[name=parentPhone]').fill('699 12 34 56');
    await dlg.getByRole('button', { name: "Inscrire l'élève" }).click();
    await toast(admin, /est inscrit/);
    await admin.goto(`${BASE}/admin/eleves?q=TESTEUR`);
    assert(await admin.getByText('TESTEUR Junior').count(), 'élève absent de la liste');
  });
  await step('génération du compte parent (identifiant = téléphone)', async () => {
    await admin.goto(`${BASE}/admin/parents?q=TESTEUR`);
    await admin.getByRole('button', { name: /Créer l.accès/ }).first().click();
    const overlay = admin.getByText('Identifiants générés');
    await overlay.waitFor();
    const txt = await admin.locator('.font-mono').filter({ hasText: '699123456' }).first().innerText();
    parentPassword = txt.split('·')[1].trim();
    assert(/^[A-Za-z]+[@#*!+]\d{4}$/.test(parentPassword), `mot de passe inattendu : ${parentPassword}`);
    const pdf = await admin.request.post(`${BASE}/api/pdf/acces`, { data: { creds: [{ name: 'M. TESTEUR Albert', role: 'PARENT', username: '699123456', password: parentPassword }] }, headers: { origin: BASE } });
    assert(pdf.status() === 200 && (await pdf.body()).subarray(0, 4).toString() === '%PDF', 'fiche d’accès PDF invalide');
    await admin.getByRole('button', { name: 'Fermer' }).first().click();
  });
  await step('encaissement d’un paiement et reçu PDF avec QR code', async () => {
    await admin.goto(`${BASE}/admin/paiements?nouveau=1`);
    const dlg = admin.locator('dialog[open]');
    await dlg.getByPlaceholder(/Tapez un nom/).fill('TESTEUR');
    await dlg.locator('select[name=studentId]').selectOption({ index: 1 });
    await dlg.locator('input[name=amount]').fill('14000');
    await dlg.getByRole('button', { name: 'Enregistrer le paiement' }).click();
    await toast(admin, /Paiement enregistré/);
    const href = await dlg.getByRole('link', { name: /Imprimer le reçu/ }).getAttribute('href');
    const r = await admin.request.get(BASE + href);
    const pdf = await r.body();
    assert(r.status() === 200 && pdf.subarray(0, 4).toString() === '%PDF', 'reçu PDF invalide');
    let text = null;
    try {
      const f = path.join(os.tmpdir(), `recu-${Date.now()}.pdf`);
      fs.writeFileSync(f, pdf);
      text = execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' });
      fs.unlinkSync(f);
    } catch {}
    if (text !== null) assert(/Mode\s+Espèces/.test(text), `mode de paiement mal libellé sur le reçu : ${(text.match(/Mode.*$/m) || [''])[0]}`);
  });
  await step('ajout d’une séance du jour pour l’encadreur Paul NDJOCK', async () => {
    await admin.goto(`${BASE}/admin/seances`);
    await admin.getByRole('button', { name: /Séance ponctuelle/ }).click();
    const dlg = admin.locator('dialog[open]');
    await dlg.locator('input[name=date]').fill(today);
    await dlg.locator('input[name=startTime]').fill('00:05');
    await dlg.locator('input[name=endTime]').fill('23:55');
    await dlg.locator('select[name=classId]').selectOption({ label: 'Terminale' });
    await dlg.locator('select[name=subjectId]').selectOption({ label: 'Algorithmique et programmation' });
    await dlg.locator('select[name=tutorId]').selectOption({ label: 'Paul NDJOCK' });
    await dlg.locator('select[name=roomId]').selectOption({ label: 'Salle A' });
    await dlg.getByRole('button', { name: 'Ajouter' }).click();
    await toast(admin, /Séance ajoutée/);
  });
  await step('message aux parents d’une classe (personnalisé)', async () => {
    // Deux envois : la boîte du parent contiendra deux messages (utile au test d'effacement)
    for (let i = 0; i < 2; i++) {
      await admin.goto(`${BASE}/admin/messages`);
      await admin.getByText('Par classe', { exact: true }).click();
      await admin.locator('label.chip').filter({ hasText: 'Seconde TI' }).click();
      await admin.getByRole('button', { name: /Envoyer le message/ }).click();
      await admin.getByText(/Message déposé dans l’espace de \d+ destinataire/).first().waitFor({ timeout: 20000 });
    }
    assert(await admin.getByRole('link', { name: /WhatsApp/ }).count() >= 1, 'lien WhatsApp absent');
  });
  await step('paiement des salaires d’octobre (au prorata des heures)', async () => {
    await admin.goto(`${BASE}/admin/salaires?mois=2026-10`);
    await admin.getByRole('button', { name: 'Tout payer' }).click();
    await toast(admin, /salaire\(s\) payé\(s\)/, 60000);
    await admin.goto(`${BASE}/admin/salaires?mois=2026-10`);
    assert((await admin.locator('.badge', { hasText: 'Payé' }).count()) >= 6, 'salaires non marqués payés');
    const pdf = await admin.request.get(`${BASE}/api/pdf/salaires?mois=2026-10`);
    assert(pdf.status() === 200, 'PDF salaires');
  });
  await step('règlement de la location des salles d’octobre', async () => {
    await admin.goto(`${BASE}/admin/location?mois=2026-10`);
    await admin.getByRole('button', { name: 'Marquer comme réglé' }).click();
    await toast(admin, /Location de octobre 2026 réglée/);
  });
  await step('location : ajout d’une date (séances, durée, tarif par heure)', async () => {
    await admin.goto(`${BASE}/admin/location?mois=2026-11`);
    await admin.getByRole('button', { name: 'Ajouter une date' }).click();
    const dlg = admin.locator('dialog[open]');
    await dlg.locator('select[name=roomId]').selectOption({ label: 'Salle A' });
    await dlg.locator('input[name=date]').fill('2026-11-21');
    await dlg.locator('input[name=seances]').fill('2');
    await dlg.locator('input[name=heures]').fill('3');
    await dlg.locator('select[name=minutes]').selectOption('30');
    await dlg.locator('input[name=rate]').fill('1500');
    await dlg.locator('input[name=label]').fill('Séance de rattrapage TESTEUR');
    assert(/5\s?250 FCFA/.test(await dlg.innerText()), 'montant prévisionnel attendu : 5 250 FCFA');
    await dlg.getByRole('button', { name: /Ajouter à l'état de location/ }).click();
    await toast(admin, /ajoutée à l’état de location/);
    await admin.goto(`${BASE}/admin/location?mois=2026-11`);
    const row = admin.locator('tr', { hasText: '21/11/2026' });
    await row.waitFor({ timeout: 15000 });
    assert(/Ajout/.test(await row.innerText()) && /Séance de rattrapage TESTEUR/.test(await row.innerText()), 'ligne ajoutée non signalée');
    const pdf = await admin.request.get(`${BASE}/api/pdf/location?mois=2026-11`);
    assert(pdf.ok(), 'état de location PDF');
    try {
      const f = path.join(os.tmpdir(), `location-${Date.now()}.pdf`);
      fs.writeFileSync(f, await pdf.body());
      const text = execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' });
      fs.unlinkSync(f);
      assert(/21\/11\/2026 \*/.test(text) && /Journée ajoutée/.test(text), 'ligne ajoutée absente du PDF');
    } catch (e) {
      if (!/ENOENT/.test(String(e.message))) throw e;
    }
  });
  await step('location : suppression puis rétablissement d’une date calculée, suppression d’une date ajoutée', async () => {
    await admin.goto(`${BASE}/admin/location?mois=2026-11`);
    const computedRow = admin.locator('section', { hasText: 'Salle A' }).locator('tbody tr').filter({ hasNotText: 'Ajout' }).filter({ hasNotText: 'Total' }).first();
    const date = (await computedRow.locator('td').first().innerText()).match(/\d{2}\/\d{2}\/\d{4}/)[0];
    await computedRow.getByRole('button', { name: /Supprimer la ligne/ }).click();
    await toast(admin, /retirée de l’état de location/);
    await admin.goto(`${BASE}/admin/location?mois=2026-11`);
    const ex = admin.locator('section', { hasText: 'Dates retirées de l’état' });
    await ex.waitFor({ timeout: 15000 });
    assert(new RegExp(date.replace(/\//g, '\\/')).test(await ex.innerText()), 'date retirée non listée');
    await ex.getByRole('button', { name: /Rétablir/ }).first().click();
    await toast(admin, /rétablie/);
    await admin.goto(`${BASE}/admin/location?mois=2026-11`);
    await admin.locator('tr', { hasText: '21/11/2026' }).getByRole('button', { name: /Supprimer la ligne/ }).click();
    await toast(admin, /supprimée de l’état de location/);
    await admin.goto(`${BASE}/admin/location?mois=2026-11`);
    assert(!(await admin.locator('tr', { hasText: '21/11/2026' }).count()), 'la date ajoutée devrait être supprimée');
    assert(!(await admin.locator('section', { hasText: 'Dates retirées de l’état' }).count()), 'aucune date ne devrait rester retirée');
  });
  await step('location : mois antérieur déjà réglé — ajout d’une date, complément réglé, puis trop-payé', async () => {
    await admin.goto(`${BASE}/admin/location?mois=2026-10`);
    assert(await admin.getByRole('link', { name: 'Mois précédent' }).count(), 'navigation vers le mois précédent absente');
    await admin.getByRole('button', { name: 'Ajouter une date' }).click();
    const dlg = admin.locator('dialog[open]');
    await dlg.locator('select[name=roomId]').selectOption({ label: 'Salle A' });
    await dlg.locator('input[name=date]').fill('2026-10-24');
    await dlg.locator('input[name=seances]').fill('2');
    await dlg.locator('input[name=heures]').fill('2');
    await dlg.locator('input[name=rate]').fill('1000');
    await dlg.locator('input[name=label]').fill('Réunion des parents TESTEUR');
    await dlg.getByRole('button', { name: /Ajouter à l'état de location/ }).click();
    await toast(admin, /ajoutée à l’état de location/);
    await admin.goto(`${BASE}/admin/location?mois=2026-10`);
    const octText = await admin.locator('main').innerText();
    assert(/complément à régler : 2\s?000\sFCFA/.test(octText), `complément à régler non affiché : ${octText.split('\n').filter((l) => /réglé|complément|trop|conforme|TOTAL/i.test(l)).join(' | ')}`);
    await admin.getByRole('button', { name: /Régler le complément/ }).click();
    await toast(admin, /Complément de 2\s?000\sFCFA réglé/);
    await admin.goto(`${BASE}/admin/location?mois=2026-10`);
    assert(/État conforme au montant réglé/.test(await admin.locator('main').innerText()), 'état non soldé après le complément');
    await admin.goto(`${BASE}/admin/depenses`);
    assert(/complément octobre 2026/.test(await admin.locator('main').innerText()), 'dépense de complément absente');
    await admin.goto(`${BASE}/admin/location?mois=2026-10`);
    await admin.locator('tr', { hasText: '24/10/2026' }).getByRole('button', { name: /Supprimer la ligne/ }).click();
    await toast(admin, /supprimée de l’état de location/);
    await admin.goto(`${BASE}/admin/location?mois=2026-10`);
    assert(/trop-payé de 2\s?000\sFCFA/.test(await admin.locator('main').innerText()), 'trop-payé non signalé');
    const pdf = await admin.request.get(`${BASE}/api/pdf/location?mois=2026-10`);
    assert(pdf.ok(), 'état de location PDF (mois réglé)');
    try {
      const f = path.join(os.tmpdir(), `location-oct-${Date.now()}.pdf`);
      fs.writeFileSync(f, await pdf.body());
      const text = execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' });
      fs.unlinkSync(f);
      assert(/Montant déjà réglé/.test(text) && /trop-payé/.test(text), 'situation du règlement absente du PDF');
    } catch (e) {
      if (!/ENOENT/.test(String(e.message))) throw e;
    }
  });
  await step('location : mois de location à cheval sur deux mois (intervalle, raccord, date du mois suivant)', async () => {
    const setInterval = async (mois, du, au) => {
      await admin.goto(`${BASE}/admin/location?mois=${mois}`);
      await admin.getByRole('button', { name: /Modifier l'intervalle/ }).click();
      const dlg = admin.locator('dialog[open]');
      await dlg.locator('input[name=start]').fill(du);
      await dlg.locator('input[name=end]').fill(au);
      await dlg.getByRole('button', { name: /Enregistrer l'intervalle/ }).click();
    };
    // Septembre 15/09 → 14/10 chevaucherait octobre (réglé, intervalle figé) : refusé
    await setInterval('2026-09', '2026-09-15', '2026-10-14');
    await toast(admin, /Chevauchement avec le mois de location de octobre 2026/);
    // Novembre du 15/11 au 14/12 : accepté
    await setInterval('2026-11', '2026-11-15', '2026-12-14');
    await toast(admin, /Mois de location de novembre 2026 : du 15\/11\/2026 au 14\/12\/2026/);
    await admin.goto(`${BASE}/admin/location?mois=2026-11`);
    assert(/du 15\/11\/2026 au 14\/12\/2026/.test(await admin.locator('main').innerText()), 'intervalle non affiché');
    assert(/À cheval sur deux mois/.test(await admin.locator('main').innerText()), 'mention « à cheval sur deux mois » absente');
    // Une date de décembre appartient au mois de location de novembre
    await admin.getByRole('button', { name: 'Ajouter une date' }).click();
    const dlg = admin.locator('dialog[open]');
    await dlg.locator('select[name=roomId]').selectOption({ label: 'Salle B' });
    await dlg.locator('input[name=date]').fill('2026-12-05');
    await dlg.locator('input[name=heures]').fill('2');
    await dlg.locator('input[name=rate]').fill('1000');
    await dlg.getByRole('button', { name: /Ajouter à l'état de location/ }).click();
    await toast(admin, /05\/12\/2026 ajoutée à l’état de location/);
    await admin.goto(`${BASE}/admin/location?mois=2026-11`);
    assert(await admin.locator('tr', { hasText: '05/12/2026' }).count(), 'la date de décembre doit figurer dans le mois de location de novembre');
    // Décembre se raccorde : il commence le 15/12
    await admin.goto(`${BASE}/admin/location?mois=2026-12`);
    assert(/du 15\/12\/2026 au 31\/12\/2026/.test(await admin.locator('main').innerText()), 'décembre non raccordé');
    // Retour à l'intervalle par défaut
    await admin.goto(`${BASE}/admin/location?mois=2026-11`);
    await admin.getByRole('button', { name: /Intervalle par défaut/ }).click();
    await toast(admin, /intervalle par défaut rétabli \(du 01\/11\/2026 au 30\/11\/2026\)/);
  });
  await step('paramètre « début du mois de location » : mois réglé figé, mois suivant raccordé', async () => {
    const setStartDay = async (n) => {
      await admin.goto(`${BASE}/admin/parametres`);
      const form = admin.locator('form', { has: admin.locator('input[name=rentStartDay]') });
      await form.locator('input[name=rentStartDay]').fill(String(n));
      await form.getByRole('button', { name: 'Enregistrer' }).click();
      await toast(admin, /Paramètres enregistrés/);
    };
    await setStartDay(15);
    await admin.goto(`${BASE}/admin/location?mois=2026-10`);
    assert(/du 01\/10\/2026 au 31\/10\/2026/.test(await admin.locator('main').innerText()), 'le mois réglé doit garder son intervalle');
    await admin.goto(`${BASE}/admin/location?mois=2026-11`);
    assert(/du 01\/11\/2026 au 14\/12\/2026/.test(await admin.locator('main').innerText()), 'novembre doit se raccorder à octobre et finir le 14/12');
    await admin.goto(`${BASE}/admin/location?mois=2026-12`);
    assert(/du 15\/12\/2026 au 14\/01\/2027/.test(await admin.locator('main').innerText()), 'décembre doit aller du 15/12 au 14/01');
    await setStartDay(1);
  });
  await step('approbation d’un document pédagogique', async () => {
    await admin.goto(`${BASE}/admin/documents?statut=SOUMIS`);
    await admin.getByRole('button', { name: /Examiner/ }).first().click();
    await admin.locator('dialog[open]').getByRole('button', { name: 'Enregistrer' }).click();
    await toast(admin, /Document approuvé/);
  });
  await step('état de caisse PDF', async () => {
    const r = await admin.request.get(`${BASE}/api/pdf/caisse?du=2026-10-01&au=${today}`);
    assert(r.status() === 200, 'état de caisse');
  });

  console.log('Encadreur');
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const tutor = await ctxB.newPage();
  tutor.on('dialog', (d) => d.accept());
  await step('connexion encadreur (smartphone)', async () => login(tutor, 'encadreur', 'paul.ndjock', 'Demo@2026'));
  await step('démarrage de la séance du jour', async () => {
    await tutor.goto(`${BASE}/encadreur`);
    await tutor.getByRole('button', { name: /Démarrer la séance/ }).first().click();
    await toast(tutor, /Séance démarrée/);
  });
  let seanceUrl = '';
  await step('appel des élèves', async () => {
    await tutor.goto(`${BASE}/encadreur`);
    await tutor.getByRole('link', { name: /Faire l.appel/ }).first().click();
    await tutor.waitForURL(/\/encadreur\/seances\/\d+/);
    seanceUrl = tutor.url().split('#')[0];
    await tutor.getByRole('button', { name: 'Tous présents' }).click();
    await tutor.locator('label[title=Absent]').nth(1).click();
    await tutor.getByRole('button', { name: /Enregistrer l.appel/ }).click();
    const t = await toast(tutor, /Appel enregistré/);
    assert(/1 absent/.test(t), t);
  });
  await step('fin de séance', async () => {
    await tutor.goto(seanceUrl);
    await tutor.getByRole('button', { name: /Terminer la séance/ }).click();
    await toast(tutor, /Séance terminée/);
  });
  await step('dépôt d’une fiche de TD (PDF) et refus d’un faux PDF', async () => {
    await tutor.goto(seanceUrl);
    const form = tutor.locator('form').filter({ has: tutor.locator('input[name=file]') });
    await form.locator('input[name=file]').setInputFiles(path.join(FIX, 'faux.pdf'));
    await form.getByRole('button', { name: /Déposer la fiche/ }).click();
    await toast(tutor, /document PDF valide/);
    await form.locator('input[name=file]').setInputFiles(path.join(FIX, 'fiche-td.pdf'));
    await form.getByRole('button', { name: /Déposer la fiche/ }).click();
    await toast(tutor, /Document déposé/);
  });
  await step('création d’une évaluation et saisie des notes', async () => {
    await tutor.goto(seanceUrl);
    await tutor.getByRole('link', { name: /Saisir les notes/ }).click();
    const dlg = tutor.locator('dialog[open]');
    await dlg.locator('input[name=title]').fill('Interrogation E2E');
    await dlg.getByRole('button', { name: /Créer et saisir/ }).click();
    await tutor.waitForURL(/\/encadreur\/notes\/\d+/);
    const inputs = tutor.locator('input[name^=g_]');
    await inputs.nth(0).fill('15,5');
    await inputs.nth(1).fill('abs');
    await inputs.nth(2).fill('12');
    await tutor.getByRole('button', { name: 'Enregistrer les notes' }).click();
    await toast(tutor, /3 note\(s\) enregistrée/);
    await inputs.nth(0).fill('25');
    await tutor.getByRole('button', { name: 'Enregistrer les notes' }).click();
    await toast(tutor, /Note invalide/);
  });
  await step('envoi de l’état de suivi au parent', async () => {
    await tutor.goto(`${BASE}/encadreur/eleves`);
    await tutor.locator('a[href^="/encadreur/eleves/"]').first().click();
    await tutor.getByRole('button', { name: /Envoyer au parent/ }).click();
    await toast(tutor, /État de suivi envoyé/);
  });
  await step('cloisonnement : un encadreur ne peut pas ouvrir l’administration', async () => {
    await tutor.goto(`${BASE}/admin/paiements`);
    assert(new URL(tutor.url()).pathname === '/encadreur', `redirigé vers ${tutor.url()}`);
    const r = await tutor.request.get(`${BASE}/api/pdf/salaires?mois=2026-10`);
    assert(r.status() === 403, `PDF salaires accessible (${r.status()})`);
    const e = await tutor.request.get(`${BASE}/api/export/sauvegarde`);
    assert(e.status() === 403, 'export accessible');
  });

  console.log('Parent');
  const ctxC = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const parent = await ctxC.newPage();
  await step('connexion du nouveau parent avec le numéro de téléphone', async () => login(parent, 'parent', '699 12 34 56', parentPassword));
  await step('tableau de bord : enfant, solde, prochaine séance', async () => {
    await parent.goto(`${BASE}/parent`);
    await parent.getByText('Junior TESTEUR').waitFor();
  });
  await step('messages reçus et marquage comme lus', async () => {
    await parent.goto(`${BASE}/parent/messages`);
    await parent.getByText('Rappel de paiement').first().waitFor();
    await parent.getByRole('button', { name: /Tout marquer comme lu/ }).click();
    await toast(parent, /marqués comme lus/);
  });
  await step('effacement d’un message lu puis de tous les messages lus', async () => {
    parent.on('dialog', (d) => d.accept());
    await parent.goto(`${BASE}/parent/messages`);
    const before = await parent.locator('article').count();
    assert(before >= 2, `au moins 2 messages attendus, ${before} trouvé(s)`);
    await parent.locator('article').first().getByRole('button', { name: /Effacer ce message/ }).click();
    await toast(parent, /Message effacé/);
    await parent.waitForFunction((n) => document.querySelectorAll('article').length === n - 1, before, { timeout: 15000 });
    await parent.getByRole('button', { name: /Effacer les messages lus/ }).click();
    await toast(parent, /message\(s\) lu\(s\) effacé/);
    await parent.getByText('Aucun message').waitFor({ timeout: 15000 });
  });
  await step('historique d’envoi de l’administration conservé après effacement', async () => {
    await admin.goto(`${BASE}/admin/messages`);
    assert(/Rappel de paiement/.test(await admin.locator('main').innerText()), 'message absent de l’historique');
  });
  await step('état de suivi et reçu de son enfant (PDF)', async () => {
    await parent.goto(`${BASE}/parent/paiements`);
    const href = await parent.getByRole('link', { name: /Reçu/ }).first().getAttribute('href');
    const r = await parent.request.get(BASE + href);
    assert(r.status() === 200, 'reçu');
    const kid = await parent.getByRole('link', { name: /Paiements/ }).first().getAttribute('href');
    const kidId = new URL(BASE + kid).searchParams.get('enfant');
    const s = await parent.request.get(`${BASE}/api/pdf/suivi/${kidId}`);
    assert(s.status() === 200, `suivi ${s.status()}`);
  });
  await step('cloisonnement : un parent ne voit pas les documents d’un autre enfant', async () => {
    const r = await parent.request.get(`${BASE}/api/pdf/suivi/1`);
    assert(r.status() === 403, `suivi d’un autre élève accessible (${r.status()})`);
    const r2 = await parent.request.get(`${BASE}/api/pdf/recu/1`);
    assert(r2.status() === 403, 'reçu d’un autre élève accessible');
    await parent.goto(`${BASE}/encadreur`);
    assert(new URL(parent.url()).pathname === '/parent', 'espace encadreur accessible');
  });

  console.log('Sécurité');
  const ctxD = await browser.newContext();
  const intruder = await ctxD.newPage();
  await step('verrouillage du compte après 5 mots de passe erronés', async () => {
    let msg = '';
    for (let i = 0; i < 5; i++) {
      await intruder.goto(`${BASE}/encadreur/connexion`);
      await intruder.fill('#username', 'aline.mekongo');
      await intruder.fill('#password', `Mauvais${i}x`);
      await intruder.click('button[type=submit]');
      msg = await intruder.locator('#login-error').innerText({ timeout: 15000 });
    }
    assert(/verrouillé/.test(msg), msg);
    await intruder.fill('#password', 'Demo@2026');
    await intruder.click('button[type=submit]');
    await intruder.locator('#login-error', { hasText: 'temporairement verrouillé' }).waitFor({ timeout: 15000 }).catch(async (e) => {
      throw new Error(`${e.message.split('\n')[0]} — message affiché : ${await intruder.locator('#login-error').allInnerTexts()} — url ${intruder.url()}`);
    });
    assert(intruder.url().endsWith('/encadreur/connexion'), 'connexion possible malgré le verrouillage');
  });
  await step('mauvais espace : un parent refusé sur la connexion encadreur', async () => {
    await intruder.goto(`${BASE}/encadreur/connexion`);
    await intruder.fill('#username', '690000001');
    await intruder.fill('#password', 'Demo@2026');
    await intruder.click('button[type=submit]');
    assert(/n'appartient pas à cet espace/.test(await intruder.locator('#login-error').innerText({ timeout: 15000 })), 'message attendu');
  });
  await step('en-têtes de sécurité (CSP avec nonce, HSTS, anti-clickjacking)', async () => {
    const r = await intruder.request.get(`${BASE}/connexion`);
    const h = r.headers();
    assert(/script-src 'self' 'nonce-/.test(h['content-security-policy'] || ''), 'CSP absente');
    assert(h['x-content-type-options'] === 'nosniff', 'nosniff');
    assert(/max-age/.test(h['strict-transport-security'] || ''), 'HSTS');
    assert(!h['x-powered-by'], 'x-powered-by exposé');
  });
  await step('accès anonyme refusé aux fichiers et PDF', async () => {
    assert((await intruder.request.get(`${BASE}/api/pdf/caisse`)).status() === 401, 'caisse');
    assert((await intruder.request.get(`${BASE}/api/export/eleves`)).status() === 403, 'export');
  });

  console.log('Administrateur (fin)');
  await step('suppression d’un planning : créneaux et séances à venir, séances réalisées conservées', async () => {
    await admin.goto(`${BASE}/admin/planning`);
    await admin.getByRole('button', { name: 'Supprimer un planning' }).click();
    const dlg = admin.locator('dialog[open]');
    await dlg.locator('select[name=scope]').selectOption('TOUT');
    await dlg.locator('input[name=confirm]').check();
    await dlg.getByRole('button', { name: 'Supprimer le planning' }).click();
    await toast(admin, /Planning de toutes les classes supprimé/);
    await admin.goto(`${BASE}/admin/planning`);
    assert(/· 0 créneau\(x\)/.test(await admin.locator('main').innerText()), 'des créneaux subsistent');
    await admin.goto(`${BASE}/admin/seances?statut=TERMINEE`);
    assert(/Terminée/.test(await admin.locator('main').innerText()), 'les séances réalisées doivent être conservées');
  });

  await browser.close();
  console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
  process.exit(failed ? 1 : 0);
})();
