/**
 * SONDE B3 — plateformes d'ACTIVITÉS autres que Groupon, par pays.
 *
 * Règle : on ne compte pas des mots dans le HTML, on fait tourner le VRAI
 * lecteur d'enseigne (`offresEnseigne`) sur chaque page candidate et on ne
 * retient que les offres à DEUX PRIX RÉELS (une remise calculée, 15–90 %).
 *
 * Contrôle POSITIF : une page qui marche doit rendre des offres.
 * Contrôle NÉGATIF : une URL inventée doit rendre ZÉRO offre — sinon la sonde
 * mesure du bruit et tout ce qu'elle dira ensuite ne vaut rien.
 *
 * Politesse : au moins 1 s entre deux requêtes.
 */
import { execFileSync } from 'node:child_process';
import { setTimeout as dormir } from 'node:timers/promises';
import { offresEnseigne } from '../collecteur.mjs';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

// [pays, nom, url, langue]
const CANDIDATS = [
  // Contrôles négatifs (doivent rendre 0)
  ['--', 'NEG-domaine', 'https://www.inexistant-b3-xyzzy-test.example/offres', 'fr'],
  ['BE', 'NEG-groupon-404', 'https://www.groupon.be/fr/chemin-inexistant-b3-xyzzy', 'fr'],

  // BELGIQUE
  ['BE', 'bongo.be', 'https://www.bongo.be/', 'fr'],
  ['BE', 'funbooker.be', 'https://www.funbooker.be/fr/', 'fr'],
  ['BE', 'smartbox.com', 'https://www.smartbox.com/be-fr/', 'fr'],
  ['BE', 'vente-exclusive.be', 'https://www.vente-exclusive.com/be/', 'fr'],
  // FRANCE
  ['FR', 'wonderbox.fr', 'https://www.wonderbox.fr/', 'fr'],
  ['FR', 'smartbox.fr', 'https://www.smartbox.com/fr/', 'fr'],
  ['FR', 'billetreduc.com', 'https://www.billetreduc.com/', 'fr'],
  ['FR', 'francebillet.com', 'https://www.francebillet.com/', 'fr'],
  ['FR', 'veepee.fr', 'https://www.veepee.fr/', 'fr'],
  // PAYS-BAS
  ['NL', 'actievandedag.nl', 'https://www.actievandedag.nl/', 'nl'],
  ['NL', 'socialdeal.nl', 'https://www.socialdeal.nl/', 'nl'],
  ['NL', 'vakantieveilingen.nl', 'https://www.vakantieveilingen.nl/', 'nl'],
  // ALLEMAGNE
  ['DE', 'dealabs.de', 'https://www.dealabs.de/', 'de'],
  ['DE', 'smartbox.de', 'https://www.smartbox.com/de/', 'de'],
  // ESPAGNE
  ['ES', 'atrapalo.com', 'https://www.atrapalo.com/', 'es'],
  ['ES', 'letsbonus.com', 'https://www.letsbonus.com/', 'es'],
  ['ES', 'groupalia.es', 'https://www.groupalia.es/', 'es'],
  // ITALIE
  ['IT', 'groupalia.it', 'https://www.groupalia.it/', 'it'],
  ['IT', 'smartbox.it', 'https://www.smartbox.com/it/', 'it'],
  // ROYAUME-UNI / IRLANDE
  ['GB', 'wowcher.co.uk', 'https://www.wowcher.co.uk/', 'en'],
  ['GB', 'travelzoo.com', 'https://www.travelzoo.com/uk/', 'en'],
  ['GB', 'secretescapes.com', 'https://www.secretescapes.com/', 'en'],
  ['IE', 'pigsback.com', 'https://www.pigsback.com/', 'en'],
  // POLOGNE
  ['PL', 'grupon.pl', 'https://www.grupon.pl/', 'pl'],
];

function page(url, langue) {
  try {
    const html = execFileSync('curl', ['-sL', '--max-time', '20', '-A', UA,
      '-H', `Accept-Language: ${langue},en;q=0.8`, url],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return html;
  } catch (e) { return ''; }
}

const source = (pays, nom, url, langue) => ({
  id: `probe-b3-${pays}-${nom}`, nom, type: 'enseigne', pays, langue,
  categorieImposee: 'activite', url,
});

const jsonLd = (html) => (html.match(/application\/ld\+json/gi) || []).length;

console.log('pays  plateforme                 octets     ld   lues  2prix  exemple');
for (const [pays, nom, url, langue] of CANDIDATS) {
  const html = page(url, langue);
  const offres = html ? offresEnseigne(html, source(pays, nom, url, langue)) : [];
  await dormir(1200);
  const deuxPrix = offres.filter((o) => o.remise != null);
  // Écarte les remises fabriquées : on ne compte que 15–90 %.
  const propres = deuxPrix.filter((o) => o.remise >= 15 && o.remise <= 90);
  const ex = propres[0] ? `${propres[0].remise}% ${propres[0].titre.slice(0, 34)}` : (offres[0] ? `(sans 2e prix) ${offres[0].titre.slice(0, 30)}` : '—');
  console.log(
    `${pays.padEnd(5)} ${nom.padEnd(24)} ${String(html.length).padStart(7)} ${String(jsonLd(html)).padStart(4)} ${String(offres.length).padStart(6)} ${String(propres.length).padStart(5)}  ${ex}`,
  );
}
