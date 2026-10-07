#!/usr/bin/env node
/* Épreuve réelle du domaine : on ouvre https://kazendra.com/ dans un vrai
   navigateur et on lit ce qui s'affiche. Un 200 sur l'index ne prouve pas que
   les offres se dessinent — donc on compte les cartes, on lit l'en-tête, on
   relève les erreurs JavaScript, et on regarde `localStorage` pour la langue. */
const { chromium } = require('playwright');

(async () => {
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage({ viewport: { width: 390, height: 844 } });

  const erreurs = [];
  page.on('pageerror', e => erreurs.push('JS: ' + e.message));
  page.on('requestfailed', r => erreurs.push('RÉSEAU: ' + r.url() + ' (' + (r.failure() || {}).errorText + ')'));

  const debut = Date.now();
  await page.goto('https://kazendra.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const msChargement = Date.now() - debut;

  await page.waitForSelector('.offre', { timeout: 45000 });
  await page.waitForTimeout(1200);

  const lecture = await page.evaluate(() => {
    const txt = s => { const e = document.querySelector(s); return e ? e.textContent.trim().replace(/\s+/g, ' ') : '(absent)'; };
    return {
      titre: document.title,
      adresse: location.href,
      enTete: [...document.querySelectorAll('.en-tete p, .en-tete div')].slice(0, 6).map(e => e.textContent.trim().replace(/\s+/g, ' ')).filter(Boolean),
      cartes: document.querySelectorAll('.offre').length,
      premiereCarte: txt('.offre'),
      rubriques: [...document.querySelectorAll('.rubrique, .rubriques button, nav button')].slice(0, 14).map(b => b.textContent.trim()).filter(Boolean),
      langue: localStorage.getItem('promos.langue'),
      imagesKo: [...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0).length,
      imagesTotal: document.querySelectorAll('img').length,
      lienCssKo: [...document.styleSheets].length,
      policeChargee: document.fonts ? document.fonts.size : 0,
    };
  });

  await page.screenshot({ path: '/tmp/kazendra-live-haut.png' });
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/kazendra-live-offres.png' });

  // Et la page d'administration, sur le nouveau domaine.
  await page.goto('https://kazendra.com/admin/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const adminTitre = await page.title();
  const adminChamp = await page.locator('input[type=password]').count();
  await page.screenshot({ path: '/tmp/kazendra-live-admin.png' });

  console.log(JSON.stringify({ msChargement, lecture, adminTitre, adminChamp, erreurs: erreurs.slice(0, 8), nbErreurs: erreurs.length }, null, 2));
  await navigateur.close();
})();
