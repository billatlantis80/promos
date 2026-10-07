/** Preuve, dans un processus NEUF, que le libellé RESTANT du bandeau est bien
 *  traduit dans les neuf langues (le script qui les avait ajoutés lisait le
 *  module avant de le réécrire : son propre contrôle ne valait rien).
 *
 *  Le bandeau portait DEUX phrases ; la première — « À activer : l'identifiant
 *  d'affiliation… » — a été retirée du site le 07/10/2026 parce qu'elle
 *  s'affichait devant le VISITEUR (constatée à l'écran sur kazendra.com). Sa clé
 *  a été retirée des neuf dictionnaires par `outils/retirer-cles.py`, et sa
 *  vérification ici n'aurait plus aucun sens : `t()` rendrait la clé telle
 *  quelle, ce qui ressemble à « resté en français » alors que la phrase
 *  n'existe plus. On ne garde donc que la phrase utile — celle qui prévient
 *  d'un vrai incident.
 */
import { t, definirLangue } from '../public/langues.js';

const HORS_LIGNE = "<b>Hors ligne</b> : le serveur des promos est injoignable. La liste ci-dessous est l'instantané embarqué du {n} ; les visuels ne sont pas disponibles.";
const RETIREE = "<b>À activer</b> : l'identifiant d'affiliation n'est pas encore renseigné (fichier <code>affiliation.js</code>). Les liens sortent donc en direct, sans commission.";

let restes = 0;
for (const code of ['fr', 'nl', 'de', 'en', 'es', 'it', 'pt', 'pl', 'sv']) {
  definirLangue(code);
  const a = t(HORS_LIGNE, { n: '7.10.2026' });
  const fr = code === 'fr';
  if (!fr && a === HORS_LIGNE) restes++;
  console.log(`${code} ${!fr && a === HORS_LIGNE ? '✗ RESTÉ FR' : '✓ traduit'} : ${a.replace(/<[^>]+>/g, '').slice(0, 70)}`);

  // La phrase retirée ne doit plus exister : t() doit rendre la clé telle quelle
  // dans TOUTES les langues (comportement normal d'une clé absente).
  const morte = t(RETIREE);
  if (morte !== RETIREE) console.log(`   ⚠ la phrase retirée est encore traduite en ${code} : ${morte.slice(0, 50)}…`);
}
definirLangue('fr');
console.log(restes ? `\n${restes} langue(s) NON traduite(s)` : '\nneuf langues traduites — aucun reste français');
