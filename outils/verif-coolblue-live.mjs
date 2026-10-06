/** Vérifie le lecteur sur la PAGE RÉELLE, sans attendre la fin du repos. */
import { offresEnseigne, prixReferenceEnseigne } from '../collecteur.mjs';

const source = { id: 'coolblue-be-1', nom: 'Coolblue', type: 'enseigne', pays: 'BE', langue: 'fr', url: 'https://www.coolblue.be/fr/offres' };
const r = await fetch(source.url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
    'Accept-Language': 'fr-BE,fr;q=0.9',
  },
});
const html = await r.text();
console.log(`page : ${r.status} · ${html.length} octets`);

const refs = prixReferenceEnseigne(html);
console.log(`prix de référence trouvés dans la page : ${refs.size}`);
for (const [nom, v] of refs) console.log(`   ${v} € — ${nom.slice(0, 60)}`);

const offres = offresEnseigne(html, source);
console.log(`\noffres construites : ${offres.length}`);
const avec = offres.filter((o) => o.prixAvant != null);
console.log(`   avec un prix de référence : ${avec.length}`);
const remises = offres.filter((o) => o.remiseCalculee).sort((a, b) => b.remise - a.remise);
console.log(`   avec une remise CALCULÉE : ${remises.length}`);
for (const o of remises.slice(0, 12)) {
  console.log(`      -${o.remise} % · ${o.prix} € au lieu de ${o.prixAvant} € · ${o.titre.slice(0, 46)}`);
}
console.log(`\nretenues par la règle (≥ 15 %) : ${remises.filter((o) => o.remise >= 15).length}`);
