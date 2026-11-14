/**
 * Contrôle qualité automatisé (liste de contrôle 13, 14 et 16) :
 *  - liens internes cassés : exploration de toutes les pages accessibles depuis chaque espace (public, administration, encadreur, parent) ;
 *  - contrastes et accessibilité : audit axe-core (règles WCAG 2.1 AA) de chaque page visitée ;
 *  - affichage mobile : absence de défilement horizontal à 360 px de large.
 * Prérequis : application démarrée (BASE, défaut http://localhost:3100) avec le jeu de démonstration.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:3100';
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const MAX_PER_PATTERN = 2;
const MAX_PAGES = Number(process.env.MAX_PAGES || 160);

const ROLES = [
  { name: 'public', start: ['/', '/connexion', '/confidentialite', '/verifier', '/admin/connexion', '/encadreur/connexion', '/parent/connexion'], scope: /^\/(?!admin|encadreur|parent)|^\/(admin|encadreur|parent)\/connexion$/ },
  { name: 'admin', login: '/admin/connexion', user: process.env.ADMIN_USER || 'admin', pass: process.env.ADMIN_PASS || 'Admin@2026', start: ['/admin'], scope: /^\/admin/ },
  { name: 'encadreur', login: '/encadreur/connexion', user: 'paul.ndjock', pass: 'Demo@2026', start: ['/encadreur'], scope: /^\/encadreur/ },
  { name: 'parent', login: '/parent/connexion', user: '690000001', pass: 'Demo@2026', start: ['/parent'], scope: /^\/parent/ },
];

const pattern = (u) => {
  const url = new URL(u, BASE);
  const keys = [...url.searchParams.keys()].sort().join('&');
  return url.pathname.replace(/\/\d+(?=\/|$)/g, '/:id').replace(/\/[A-Z0-9]{8,}$/, '/:code') + (keys ? `?${keys}` : '');
};

(async () => {
  const browser = await chromium.launch();
  const broken = [];
  const contrast = [];
  const otherA11y = new Map();
  const overflow = [];
  let visitedTotal = 0;
  const checkedResources = new Map();
  const details = [];

  for (const role of ROLES) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    if (role.login) {
      await page.goto(BASE + role.login);
      await page.fill('#username', role.user);
      await page.fill('#password', role.pass);
      await Promise.all([page.waitForURL((u) => !u.pathname.endsWith('/connexion'), { timeout: 30000 }), page.click('button[type=submit]')]);
    }
    const mobile = await ctx.newPage();
    await mobile.setViewportSize({ width: 360, height: 780 });
    const queue = [...role.start];
    const seen = new Set();
    const perPattern = new Map();
    let visited = 0;
    while (queue.length && visited < MAX_PAGES) {
      const path = queue.shift();
      if (seen.has(path)) continue;
      seen.add(path);
      const pat = pattern(path);
      const n = perPattern.get(pat) || 0;
      if (n >= MAX_PER_PATTERN) continue;
      perPattern.set(pat, n + 1);
      const res = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => ({ status: () => 0, err: e }));
      visited++;
      const status = res.status();
      if (status >= 400 || status === 0) { broken.push(`[${role.name}] ${status} ${path}`); continue; }
      if (role.login && new URL(page.url()).pathname.endsWith('/connexion') && !path.endsWith('/connexion')) { broken.push(`[${role.name}] redirigé vers la connexion : ${path}`); continue; }
      // Liens de la page
      const links = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
      for (const href of links) {
        if (!href || /^(tel:|mailto:|sms:|#|javascript:)/.test(href)) continue;
        const url = new URL(href, BASE + path);
        if (url.origin !== new URL(BASE).origin) continue;
        const rel = url.pathname + url.search;
        if (/^\/(api|brand|_next)\//.test(url.pathname) || /\.(pdf|png|jpe?g|webp|csv|json|xml|txt)$/.test(url.pathname)) {
          const key = `${role.name}:${pattern(rel)}`;
          if (!checkedResources.has(key)) {
            const r = await page.request.get(BASE + rel, { maxRedirects: 0 }).catch(() => null);
            checkedResources.set(key, r ? r.status() : 0);
            if (!r || r.status() >= 400) broken.push(`[${role.name}] ressource ${r ? r.status() : 0} ${rel} (depuis ${path})`);
          }
          continue;
        }
        if (role.scope.test(url.pathname) && !seen.has(rel)) queue.push(rel);
      }
      // Accessibilité (WCAG 2.1 AA), dont les contrastes
      await page.addScriptTag({ content: AXE });
      const result = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }));
      for (const v of result.violations) {
        if (v.id === 'color-contrast') {
          for (const node of v.nodes) {
            const d = node.any[0]?.data || {};
            contrast.push(`[${role.name}] ${path} → ${node.target.join(' ')} : ${d.fgColor} sur ${d.bgColor} = ${d.contrastRatio} (min ${d.expectedContrastRatio})`);
            if (process.env.DETAIL) details.push({ role: role.name, path, fg: d.fgColor, bg: d.bgColor, ratio: d.contrastRatio, html: node.html.slice(0, 220) });
          }
        } else {
          const k = `${v.id} (${v.impact})`;
          otherA11y.set(k, [...(otherA11y.get(k) || []), `${role.name}:${path} ${v.nodes.slice(0, 2).map((x) => x.target.join(' ')).join(' | ')}`]);
        }
      }
      // Affichage sur smartphone (360 px)
      await mobile.goto(BASE + path, { waitUntil: 'networkidle', timeout: 60000 });
      const ov = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (ov > 1) overflow.push(`[${role.name}] ${path} : +${ov}px`);
    }
    visitedTotal += visited;
    console.log(`[${role.name}] ${visited} page(s) contrôlée(s), ${perPattern.size} modèle(s) de page`);
    await ctx.close();
  }
  await browser.close();
  if (process.env.DETAIL) fs.writeFileSync(process.env.DETAIL, JSON.stringify(details, null, 1));

  const section = (title, list) => { console.log(`\n${title} : ${list.length ? list.length : 'aucun'}`); for (const x of list.slice(0, 60)) console.log('  - ' + x); };
  section('Liens ou ressources cassés', broken);
  section('Défauts de contraste (WCAG AA)', contrast);
  section('Autres défauts d’accessibilité', [...otherA11y.entries()].map(([k, v]) => `${k} × ${v.length} : ${v.slice(0, 3).join(' ; ')}`));
  section('Débordements horizontaux à 360 px', overflow);
  console.log(`\n${visitedTotal} pages contrôlées, ${checkedResources.size} ressources (PDF, exports, fichiers) vérifiées.`);
  process.exit(broken.length + contrast.length + otherA11y.size + overflow.length ? 1 : 0);
})();
