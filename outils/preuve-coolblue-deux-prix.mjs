/** Preuve, sur le HTML VIVANT de Coolblue, que le lecteur d'enseigne écarte
 *  désormais les articles sans second prix (règle : « une promotion sans
 *  deuxième prix n'est pas une promotion »).
 *
 *  Avant la correction, la page « offres » rendait 246 articles dont 199 prix
 *  catalogue nus. On compare ici : articles lus par le lecteur JSON-LD vs
 *  articles gardés (deux prix), et on nomme chaque article écarté. */
import { offresEnseigne } from '../collecteur.mjs';

const source = { id: 'coolblue-be-1', nom: 'Coolblue', type: 'enseigne', pays: 'BE', langue: 'fr', url: 'https://www.coolblue.be/fr/offres' };
const r = await fetch(source.url, {
  headers: {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
    'accept-language': 'fr-BE,fr;q=0.9',
  },
});
const html = await r.text();
const gardees = offresEnseigne(html, source);
console.log(`HTTP ${r.status} — ${html.length} octets`);
console.log(`Articles GARDÉS (deux prix) : ${gardees.length}`);
console.log(`Tous ont un avant/après : ${gardees.every((o) => o.prixAvant > 0 && o.prixAvant > o.prix)}`);
console.log('\nDétail (prix → avant, remise) :');
for (const o of gardees.slice(0, 25)) {
  const rem = Math.round(((o.prixAvant - o.prix) / o.prixAvant) * 100);
  console.log(`  ${String(o.prix).padStart(7)} € → ${String(o.prixAvant).padStart(7)} €  -${String(rem).padStart(2)} %  ${o.titre.slice(0, 70)}`);
}
// Combien d'articles le JSON-LD proposait-il au total, et lesquels sont écartés ?
const noms = [...html.matchAll(/"name"\s*:\s*"([^"]{8,90})"/g)].map((m) => m[1]);
console.log(`\nNoms JSON-LD repérés dans la page : ${noms.length} (dont ${noms.length - gardees.length} écartés)`);
