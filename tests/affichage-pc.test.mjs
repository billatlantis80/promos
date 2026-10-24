/* =============================================================================
   L'AFFICHAGE PC NE DOIT JAMAIS POUVOIR TOUCHER AU TÉLÉPHONE.

   Demande de B, 08/10/2026 : « quand j'utilise le site sur le PC, le design est
   améliorable car mal proportionné ». La correction est une couche AJOUTÉE à
   app.css (et à legal.css), entièrement enfermée dans des paliers
   `@media (min-width: …)`.

   Ce test protège la règle qui rend cette correction sans risque : le téléphone
   ne change pas PARCE QUE rien, dans la couche PC, ne peut s'appliquer sous
   1024 px. Il échoue si quelqu'un écrit un jour une règle « PC » hors palier —
   un défaut qu'on ne verrait pas en regardant le site sur son propre téléphone,
   et qui n'apparaîtrait que sur l'écran de B.

   Ce qui est vérifié :
     1. toute règle de la couche PC vit dans un palier d'au moins 1024 px ;
     2. le cadre vaut bien 1280 px — la décision de B (« colonne centrée ») ;
     3. aucun `!important` : une couche de mise en page ne doit pas gagner par
        la force, sinon la prochaine correction ne passe plus ;
     4. les pages administratives sont protégées par le même contrôle.
   ============================================================================= */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (nom) => readFileSync(new URL('../public/' + nom, import.meta.url), 'utf8');
const REPERE = 'DEBUT-COUCHE-PC';

/** Les têtes de bloc de PREMIER niveau d'un morceau de CSS (« @media (…) »,
 *  « .grille », …). Les profondeurs supérieures sont ignorées : ce sont des
 *  règles, pas des paliers. */
function teteDeBloc(css) {
  const tete = [];
  let niveau = 0;
  let debut = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === ';' && niveau === 0) debut = i + 1;
    else if (c === '{') { if (niveau === 0) tete.push(css.slice(debut, i).trim()); niveau++; debut = i + 1; }
    else if (c === '}') { niveau--; debut = i + 1; }
  }
  return tete;
}

/** Le code de la couche PC, commentaires retirés.
 *
 *  On coupe À LA FIN du commentaire de repère, et non à son début : couper au
 *  début laisserait une fermeture de commentaire orpheline, et le retrait des
 *  commentaires qui suit prendrait alors tout le commentaire d'explication pour
 *  du code. Défaut constaté en écrivant ce test — il accusait le commentaire
 *  d'être une règle hors palier. */
function couchePc(feuille) {
  const brut = lire(feuille);
  const debut = brut.indexOf(REPERE);
  assert.ok(debut > 0, `${feuille} : le repère « ${REPERE} » doit exister`);
  const fin = brut.indexOf('*/', debut);
  assert.ok(fin > debut, `${feuille} : le commentaire de repère doit être fermé`);
  return brut.slice(fin + 2).replace(/\/\*[\s\S]*?\*\//g, '');
}

test('chaque règle de la couche PC est enfermée dans un palier d’au moins 1024 px', () => {
  const tete = teteDeBloc(couchePc('app.css'));
  assert.ok(tete.length >= 2, 'garde-fou : la couche PC doit contenir des paliers');
  for (const t of tete) {
    assert.ok(/^@media\b/.test(t),
      `règle « ${t.slice(0, 60)} » hors palier : elle s’appliquerait AUSSI au téléphone`);
    const m = /min-width:\s*(\d+)px/.exec(t);
    assert.ok(m, `palier sans min-width en pixels : « ${t} »`);
    assert.ok(Number(m[1]) >= 1024,
      `palier à ${m[1]} px : trop bas, un téléphone en paysage y entrerait`);
  }
});

test('le cadre PC vaut 1280 px et sert de marge à l’en-tête, au contenu et au pied', () => {
  const css = couchePc('app.css');
  assert.match(css, /--large:\s*1280px/, 'le plafond de 1280 px (choix « colonne centrée ») doit rester écrit');
  assert.match(css, /\.tete\s*\{[^}]*var\(--gout\)/, 'l’en-tête doit se ranger sur la même marge que le contenu');
  assert.match(css, /main\s*\{[^}]*var\(--gout\)/, 'le contenu doit se ranger sur cette marge');
  assert.match(css, /\.pied\s*\{[^}]*var\(--gout\)/, 'le pied doit tomber sur les mêmes bords');
});

test('la couche PC n’emploie aucun !important', () => {
  for (const feuille of ['app.css', 'legal.css']) {
    assert.ok(!/!important/.test(couchePc(feuille)),
      `${feuille} : un !important dans la couche PC empêcherait la correction suivante`);
  }
});

test('les pages administratives sont protégées par le même palier', () => {
  const tete = teteDeBloc(couchePc('legal.css'));
  assert.ok(tete.length >= 1, 'legal.css doit porter sa couche PC');
  for (const t of tete) {
    assert.ok(/^@media\b.*min-width:\s*(\d+)px/.test(t), `palier inattendu dans legal.css : « ${t} »`);
    assert.ok(Number(/min-width:\s*(\d+)px/.exec(t)[1]) >= 1024, `palier trop bas dans legal.css : « ${t} »`);
  }
});

test('les valeurs du téléphone sont toujours écrites AVANT la couche PC', () => {
  // L'ordre compte : la couche PC complète la feuille, elle ne la remplace pas.
  // Si elle remontait au-dessus des règles du téléphone, les mêmes sélecteurs
  // seraient écrasés dans l'autre sens — et ce serait le téléphone qui perdrait.
  for (const feuille of ['app.css', 'legal.css']) {
    const brut = lire(feuille);
    assert.ok(brut.indexOf(REPERE) > brut.length / 2,
      `${feuille} : la couche PC doit rester en fin de feuille`);
  }
});
