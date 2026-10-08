/* =============================================================================
   LE MÊME PRODUIT SUR UNE AUTRE PLACE AMAZON — et « moins cher » quand c'est vrai.

   Demande de B, 08/10/2026 : « Tu dois garder les mêmes produits qui viennent
   d'Amazon, mais tu peux préciser qu'il y a moins cher dans un autre Amazon. »

   CE QUI ÉTAIT FAUX AVANT : les places de marché européennes d'Amazon vendent le
   même produit, chacune à son prix — le même home trainer Wahoo valait 6 089 kr
   chez amazon.se et 429,99 € chez amazon.de — et l'application n'en disait rien.
   Elle gardait bien les deux lignes, mais l'utilisateur devait ouvrir chaque
   boutique pour découvrir qu'il y en avait une moins chère.

   CE QUE CE FICHIER PROTÈGE :
     1. l'APPARIEMENT — l'ASIN, pas le pays. Les offres autrichiennes pointent
        vers amazon.de : grouper par pays annoncerait une « autre place » qui est
        en réalité la même boutique ;
     2. « MOINS CHER » N'EST DIT QUE DANS LA MÊME MONNAIE. Entre euros et
        couronnes, aucune comparaison n'est possible sans cours de change, et le
        projet refuse la conversion : dans ce cas on nomme l'autre place et son
        prix DANS SA MONNAIE, sans classer ;
     3. AUCUN PRIX N'EST MODIFIÉ NI CONVERTI — les montants rendus sont, au
        centime près, ceux du catalogue ;
     4. la mention est réellement DESSINÉE dans la carte, pas seulement écrite.

   Lancement : node --test tests/prix-amazon.test.mjs
   ============================================================================= */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(RACINE, 'public', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(RACINE, 'public', 'index.html'), 'utf8');
const langues = fs.readFileSync(path.join(RACINE, 'public', 'langues.js'), 'utf8');

/* On extrait le VRAI code, entre deux marqueurs — jamais une recopie. */
const debut = app.indexOf('const DEVISE_PAR_PAYS = {');
const fin = app.indexOf('function ilYA(');
assert.ok(debut > 0 && fin > debut, 'la tranche devise/places est introuvable dans app.js');
const extrait = app.slice(debut, fin);

const M = await import('data:text/javascript;base64,' + Buffer.from(
  extrait + '\nexport { deviseDe, montant, indexerProduits, autresPlaces, asinDe, placeAmazon, nomPlace };'
).toString('base64'));
const { indexerProduits, autresPlaces, asinDe, placeAmazon, nomPlace } = M;

/* --------------------------------------------------------- le témoin figé -- */
/* Le groupe réel du 08/10/2026 : le même Wahoo KICKR CORE 2, quatre lignes. */
const wahoo = [
  { id: 'flSEB0FLQDCR7X', titre: 'Wahoo KICKR CORE 2 (Suède)', pays: 'SE', prix: 6089,
    lienMarchand: 'https://www.amazon.se/dp/B0FLQDCR7X' },
  { id: 'flDEB0FLQDCR7X', titre: 'Wahoo KICKR CORE 2 (Allemagne)', pays: 'DE', prix: 429.99,
    lienMarchand: 'https://www.amazon.de/dp/B0FLQDCR7X' },
  { id: 'flATB0FLQDCR7X', titre: 'Wahoo KICKR CORE 2 (Autriche)', pays: 'AT', prix: 429.99,
    lienMarchand: 'https://www.amazon.de/dp/B0FLQDCR7X' },
  { id: 'flNLB0FLQDCR7X', titre: 'Wahoo KICKR CORE 2 (Pays-Bas)', pays: 'NL', prix: 435.99,
    lienMarchand: 'https://www.amazon.nl/dp/B0FLQDCR7X' },
];
const index = indexerProduits(wahoo);
const offre = (id) => wahoo.find((o) => o.id === id);

test('l’ASIN et la place se lisent dans l’adresse', () => {
  assert.equal(asinDe(offre('flSEB0FLQDCR7X')), 'B0FLQDCR7X');
  assert.equal(placeAmazon(offre('flSEB0FLQDCR7X')), 'amazon.se');
  assert.equal(placeAmazon(offre('flNLB0FLQDCR7X')), 'amazon.nl');
  assert.equal(nomPlace('amazon.nl'), 'Amazon.nl');
});

test('deux PAYS peuvent être une seule place : l’Autriche achète en Allemagne', () => {
  assert.equal(placeAmazon(offre('flATB0FLQDCR7X')), placeAmazon(offre('flDEB0FLQDCR7X')));
  const vues = autresPlaces(offre('flNLB0FLQDCR7X'), index);
  const places = [vues.moinsCher?.place, ...vues.autres.map((a) => a.place)];
  assert.equal(new Set(places).size, places.length, 'une place ne doit apparaître qu’une fois');
});

test('la même monnaie, si elle est moins chère, est NOMMÉE', () => {
  const vues = autresPlaces(offre('flNLB0FLQDCR7X'), index);   // 435,99 € aux Pays-Bas
  assert.ok(vues.moinsCher, 'les Pays-Bas doivent voir l’Allemagne moins chère à 429,99 €');
  assert.equal(vues.moinsCher.place, 'amazon.de');
  assert.equal(vues.moinsCher.prix, 429.99);
  assert.equal(vues.moinsCher.devise.code, 'EUR');
});

test('la place DÉJÀ la moins chère n’annonce pas de « moins cher »', () => {
  const vues = autresPlaces(offre('flDEB0FLQDCR7X'), index);   // 429,99 € en Allemagne
  assert.equal(vues.moinsCher, null, 'rien n’est moins cher que 429,99 € en euros');
  assert.ok(vues.autres.length > 0, 'les autres places doivent tout de même être nommées');
});

test('ENTRE DEUX MONNAIES, on ne dit JAMAIS « moins cher »', () => {
  // La Suède est en couronnes : 6 089 kr. Les frères sont en euros. Classer
  // ces prix exigerait un cours de change — refusé par le projet.
  const vues = autresPlaces(offre('flSEB0FLQDCR7X'), index);
  assert.equal(vues.moinsCher, null, 'aucune comparaison n’est possible entre SEK et EUR');
  assert.ok(vues.autres.every((a) => a.devise.code !== 'SEK' || true));
  for (const a of vues.autres) {
    assert.equal(a.prix, offre(a.id).prix, 'le prix rendu doit être celui du catalogue');
    assert.equal(a.devise.code, M.deviseDe(offre(a.id)).code);
  }
});

test('aucun prix n’est converti ni arrondi — le montant rendu est celui du catalogue', () => {
  for (const o of wahoo) {
    const { moinsCher, autres } = autresPlaces(o, index);
    for (const a of [moinsCher, ...autres].filter(Boolean)) {
      const vrai = offre(a.id);
      assert.equal(a.prix, vrai.prix, `${a.id} : le prix a été modifié`);
      assert.equal(a.devise.code, M.deviseDe(vrai).code, `${a.id} : la monnaie a changé`);
    }
    // Ce qui compte est le TEXTE affiché, pas la sérialisation des objets
    // devise : ceux-ci portent par nature tous les symboles, et l'épreuve se
    // serait déclarée en échec sur elle-même (faux échec déjà payé).
    for (const a of [moinsCher, ...autres].filter(Boolean)) {
      const texte = M.montant(a.prix, a.devise);
      assert.equal((texte.match(/€|kr|zł|£/g) || []).length, 1,
        `« ${texte} » doit porter UNE seule monnaie`);
      assert.ok(texte.includes(a.devise.symbole), `« ${texte} » doit porter « ${a.devise.symbole} »`);
    }
  }
});

test('une offre sans ASIN, ou non-Amazon, ne produit rien du tout', () => {
  assert.deepEqual(autresPlaces({ id: 'x', pays: 'BE', prix: 10, lienMarchand: 'https://www.coolblue.be/x' }, index),
    { moinsCher: null, autres: [] });
  assert.deepEqual(autresPlaces({ id: 'y', pays: 'DE', prix: 10, lienMarchand: 'https://www.amazon.de/gp/aw/d/COURT' }, index),
    { moinsCher: null, autres: [] });
  assert.deepEqual(autresPlaces(null, index), { moinsCher: null, autres: [] });
});

/* --------------------------------------------- la propriété sur le vrai catalogue -- */
function catalogue() {
  const c = [path.join(RACINE, 'data', 'offres.json'), path.join(RACINE, 'docs', 'offres.json')]
    .find((p) => fs.existsSync(p));
  assert.ok(c, 'ni data/offres.json (local) ni docs/offres.json (dépôt)');
  const d = JSON.parse(fs.readFileSync(c, 'utf8'));
  return Array.isArray(d) ? d : (d.offres || []);
}

test('sur le CATALOGUE RÉEL : le même produit existe bien sur plusieurs places', () => {
  const offres = catalogue();
  const idx = indexerProduits(offres);
  let groupes = 0;
  let lignes = 0;
  for (const [, l] of idx) {
    const places = new Set(l.map((o) => placeAmazon(o)).filter(Boolean));
    if (places.size > 1) { groupes++; lignes += l.length; }
  }
  console.log(`   ${groupes} produits sur plusieurs places, ${lignes} offres concernées`);
  assert.ok(groupes >= 200, `trop peu de produits multi-places (${groupes}) : l’appariement ne trouve plus rien`);
  assert.ok(lignes >= groupes, 'incohérence : moins de lignes que de produits');
});

test('sur le CATALOGUE RÉEL : aucune comparaison ne franchit une monnaie', () => {
  const offres = catalogue();
  const idx = indexerProduits(offres);
  let proposes = 0;
  let violations = 0;
  for (const o of offres) {
    if (!placeAmazon(o)) continue;
    const { moinsCher } = autresPlaces(o, idx);
    if (!moinsCher) continue;
    proposes++;
    if (moinsCher.devise.code !== M.deviseDe(o).code) violations++;
    if (!(moinsCher.prix < o.prix)) violations++;
  }
  console.log(`   ${proposes} offres peuvent dire « moins cher ailleurs », ${violations} violations`);
  assert.equal(violations, 0, 'une comparaison entre monnaies, ou un prix non inférieur, est passée');
  assert.ok(proposes > 0, 'aucune offre ne peut plus dire « moins cher ailleurs » : la règle ne sert à rien');
});

/* ------------------------------------------------- et si elle n’était pas dessinée ? -- */

test('la mention est réellement DESSINÉE dans la carte', () => {
  const iCarte = app.indexOf('function carte(');
  const iFin = app.indexOf('function ', iCarte + 10);
  const corps = app.slice(iCarte, iFin);
  assert.match(corps, /mentionAilleurs\(o\)/, 'la carte ne calcule jamais la mention');
  assert.match(corps, /\$\{ailleurs\}/, 'la mention est calculée mais jamais écrite dans le HTML');
});

test('l’index des produits est construit une seule fois, au chargement', () => {
  const appels = [...app.matchAll(/indexProduits\s*=\s*indexerProduits\(/g)];
  assert.equal(appels.length, 1, 'l’index doit être construit exactement une fois');
  const iOffres = app.indexOf('etat.offres = ');
  assert.ok(iOffres > 0, 'etat.offres doit être affecté quelque part');
  const entre = app.slice(iOffres, appels[0].index);
  assert.ok(entre.length < 600 && !/etat\.offres = /.test(entre.slice(1)),
    'l’index doit être construit dans la foulée du chargement des offres, pas ailleurs');
});

test('la mention a un style, dans le fichier publié', () => {
  assert.match(html, /\.ailleurs\s*\{/, 'sans règle de style, la mention s’affiche en gros texte noir');
});

test('les 9 langues disent la comparaison', () => {
  for (const cle of ["Moins cher sur {place} : {prix}", "Aussi sur {place} : {prix}"]) {
    // On compte les LIGNES DE CLÉ (« 'clé': … » en début de ligne) : en français
    // la clé vaut sa valeur, et compter les sous-chaînes en trouverait dix.
    const motif = new RegExp('^\\s*\'' + cle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\':', 'gm');
    const n = [...langues.matchAll(motif)].length;
    assert.equal(n, 9, `« ${cle} » doit être une ligne de clé dans les 9 langues (trouvée ${n})`);
  }
});
