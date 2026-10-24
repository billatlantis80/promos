/* LA PAGE DÉCIDE DE LA CARTE — épreuves de la règle de B (13/10/2026).
   =============================================================================
   Décision de B, mot pour mot : « plus de promotion sur la page la carte sort,
   promotion toujours là prix changé on corrige le prix et la remise, promotion
   toujours là même prix on garde, page morte la carte sort ».

   CE QUI EST ÉPROUVÉ ICI, et c'est le cœur de la règle : la LECTURE. Elle est
   une fonction pure (`promotionDans`), donc on l'éprouve sur des pages
   FABRIQUÉES, sans réseau — exactement l'inverse d'un test qui toucherait un
   vrai marchand.

   POURQUOI CE FICHIER EXISTE, ET PAS SEULEMENT « parce qu'il faut des tests » :
   deux défauts ont été trouvés EN SONDANT la vraie page, et chacun aurait
   supprimé des cartes à tort :

     1. le JSON d'une page marchande est échappé DEUX fois
        (`\\&quot;basisPrice\\&quot;`) : chercher `"basisPrice"` rendait zéro,
        et un zéro se lit « la page ne publie pas de prix de référence » →
        suppression. Défaut attrapé le 13/10/2026 ;
     2. un `basisPrice` de 53,99 € traînait 4 000 caractères plus loin, dans le
        JSON d'un article VOISIN : cherché dans toute la page, il faisait passer
        un article sans promotion pour un article à −85 %.

   Ces deux pièges sont donc épreuvés NOMMÉMENT ci-dessous. Une règle qui
   supprime n'a le droit de se tromper sur aucun des deux.
   ============================================================================= */
import test from 'node:test';
import assert from 'node:assert/strict';
import { promotionDans, pageEnClair } from '../collecteur.mjs';

/** Une page marchande comme les vraies : prix rendu + prix barré juste à côté. */
const pageAvecPromo = `
<span id="corePriceDisplay_desktop_feature_div"><span class="a-price">
<span class="a-price-whole">12<span class="a-price-decimal">,</span></span>
<span class="a-price-fraction">99</span><span class="a-price-symbol">€</span></span>
<span class="a-text-price"><span class="a-offscreen">24,99 €</span></span></span>`;

/** La même, mais le marchand a RETIRÉ la promotion : plus qu'un seul prix. */
const pageSansPromo = `
<span id="corePriceDisplay_desktop_feature_div"><span class="a-price">
<span class="a-price-whole">7<span class="a-price-decimal">,</span></span>
<span class="a-price-fraction">99</span><span class="a-price-symbol">€</span></span></span>`;

test('la promotion est là : le prix demandé ET le prix de référence sont lus', () => {
  const p = promotionDans(pageAvecPromo);
  assert.equal(p.lisible, true, 'la page publie un prix : on est lisible');
  assert.equal(p.prix, 12.99);
  assert.equal(p.prixAvant, 24.99);
});

test('la promotion n’est plus là : la carte sort (prixAvant reste vide)', () => {
  const p = promotionDans(pageSansPromo);
  assert.equal(p.lisible, true, 'un prix a bien été lu — donc on a le droit de conclure');
  assert.equal(p.prix, 7.99);
  assert.equal(p.prixAvant, null, 'aucun prix de référence : ce n’est plus une promotion');
  assert.match(p.detail, /aucun prix de référence/);
});

test('une page MUETTE ne conclut RIEN — la carte reste', () => {
  // C'est la garantie qui empêche la règle de faire des dégâts : un captcha,
  // une panne, un bloc de prix disparu ne prouvent pas l'absence de promotion.
  for (const muette of [
    '<html><body>Vérifiez que vous êtes un humain</body></html>',
    '',
    '<html><body><span class="a-price-whole">—</span></body></html>',
  ]) {
    const p = promotionDans(muette);
    assert.equal(p.lisible, false, 'aucun prix lisible → aucune décision possible');
    assert.equal(p.prixAvant, null);
  }
});

test('le prix barré d’un article VOISIN n’est jamais pris pour le nôtre', () => {
  // Le défaut mesuré : 53,99 €, à 4 000 caractères du prix affiché.
  const voisine = pageSansPromo + 'x'.repeat(4000)
    + String.raw`\&quot;basisPrice\&quot;:{\&quot;currency\&quot;:{\&quot;amount\&quot;:53.99}}`;
  const p = promotionDans(voisine);
  assert.equal(p.prix, 7.99);
  assert.equal(p.prixAvant, null, 'un prix barré lointain appartient à un AUTRE article');
});

test('un « prix de référence » PLUS BAS que le prix n’en est pas un', () => {
  const absurde = `
<span class="a-price-whole">19<span class="a-price-decimal">,</span></span>
<span class="a-price-fraction">99</span>
<span class="a-text-price"><span class="a-offscreen">14,99 €</span></span>`;
  const p = promotionDans(absurde);
  assert.equal(p.prix, 19.99);
  assert.equal(p.prixAvant, null, 'un barré plus bas que le prix demandé est une erreur de page, pas une promotion');
});

test('un JSON échappé DEUX fois est quand même lu (le zéro trompeur)', () => {
  // Le texte reçu contient littéralement  \\&quot;basisPrice\\&quot;
  const echappe = String.raw`<span class="a-price-whole">7<span class="a-price-decimal">,</span></span><span class="a-price-fraction">99</span>\&quot;basisPrice\&quot;:{\&quot;currency\&quot;:{\&quot;amount\&quot;:9.99}}`;
  const clair = pageEnClair(echappe);
  assert.ok(clair.includes('"basisPrice"'), 'le dé-échappement doit rendre le JSON cherchable');
  const p = promotionDans(echappe);
  assert.equal(p.prix, 7.99);
  assert.equal(p.prixAvant, 9.99, 'le prix de référence était là, sous un échappement double');
});
