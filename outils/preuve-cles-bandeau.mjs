/** Preuve, dans un processus NEUF, que les deux libellés du bandeau sont bien
 *  traduits dans les neuf langues (le script qui les a ajoutés lisait le module
 *  avant de le réécrire : son propre contrôle ne valait rien). */
import { t, definirLangue } from '../public/langues.js';
const A = "<b>À activer</b> : l'identifiant d'affiliation n'est pas encore renseigné (fichier <code>affiliation.js</code>). Les liens sortent donc en direct, sans commission.";
const B = "<b>Hors ligne</b> : le serveur des promos est injoignable. La liste ci-dessous est l'instantané embarqué du {n} ; les visuels ne sont pas disponibles.";
let restes = 0;
for (const code of ['fr', 'nl', 'de', 'en', 'es', 'it', 'pt', 'pl', 'sv']) {
  definirLangue(code);
  const a = t(A);
  const b = t(B, { n: '7.10.2026' });
  const fr = code === 'fr';
  const identique = a === A;
  if (!fr && identique) restes++;
  console.log(`${code} ${!fr && identique ? '✗ RESTÉ FR' : '✓ traduit'} : ${a.replace(/<[^>]+>/g, '').slice(0, 66)}`);
  console.log(`   hors ligne : ${b.replace(/<[^>]+>/g, '').slice(0, 62)}`);
}
console.log(restes ? `\n${restes} langue(s) NON traduite(s)` : '\nneuf langues traduites — aucun reste français');
