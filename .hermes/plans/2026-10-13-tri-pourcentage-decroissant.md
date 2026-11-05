# Le 4e choix de tri : « % décroissant » (ex-« Prix croissant »)

**Demande de B, 13/10/2026** : « Dans le menu où on a le choix entre, bonne
promotion, toutes les promotions, les plus récentes et par prix croissant.
Peux-tu adapter la catégorie prix croissant par pourcentage décroissant avec
écrit % décroissant. Tu peux mettre en production directement »

## La règle, telle qu'elle est appliquée

Le quatrième choix du sélecteur de portée s'écrit **« % décroissant »** et
classe les offres par **remise décroissante** (le pourcentage le plus fort en
tête), et non plus par montant croissant.

Trois précisions, décidées ici et écrites dans le code :

1. **Le pourcentage retenu est celui que la carte peut MONTRER**
   (`remiseMontrable`) : une remise ni calculée entre deux prix réels, ni
   crédible (annoncée mais > 90 %) n'est écrite nulle part sur la carte — elle
   ne doit donc pas non plus décider du rang. Sans cela, le haut de liste
   annoncerait des pourcentages invisibles (cas vécu : « 99 % sRGB »).
2. **Départages visibles** : à remise égale, le prix croissant, puis la
   fraîcheur. Chaque critère est lisible sur la carte, donc l'ordre reste
   explicable et stable.
3. **Les offres sans remise montrable** ferment la marche (0). Elles ne
   disparaissent pas : le choix règle l'ORDRE, pas la présence.

## Ce qui a changé, exactement

- `public/index.html` : `<option value="prix" data-i18n="Prix croissant">` →
  `<option value="pourcent" data-i18n="% décroissant">`. Même place, même
  forme, mêmes quatre entrées : **rien ne bouge au design**.
- `public/langues.js` : la clé `'Prix croissant'` remplacée par
  `'% décroissant'` dans **les neuf langues** (fr, nl, de, en, es, it, pt, pl,
  sv). La clé EST le texte français, donc la clé a suivi — et l'ancienne clé a
  disparu, sinon elle deviendrait une clé morte (épreuve
  `traductions-vivantes`).
- `public/app.js` : le comparateur `etat.tri === 'prix'` (montant croissant)
  devient `etat.tri === 'pourcent'` (remise décroissante, puis prix, puis
  date). Le nom de la valeur a suivi le comportement : garder `prix` aurait
  laissé un mensonge dans le code.
- `tests/ordre-chronologique.test.mjs` : l'épreuve qui vérifiait le tri par
  prix est remplacée par trois épreuves (remise décroissante ; un pourcentage
  non montrable ne classe pas ; à remise égale, le prix décide) + le contrôle
  du libellé « % décroissant » traduit dans les neuf langues.

## Vérifications faites (13/10/2026)

- `node --test` : **926 épreuves, 926 passent, 0 échec**.
- `bin/collecter.sh` : publication + envoi vers GitHub, passage terminé en 27 s.
- GitHub Pages : construction `built` sur le commit `6370dffd4`.
- **Site en ligne** (kazendra.com), relevé mesuré dans le navigateur, choix
  « % décroissant » actif :
  `90 90 90 90 89 88 87 ≈86 86 86 85 85 85 84 83 80…` — ordre décroissant,
  aucun écart, 24 cartes à l'écran.
- Les trois fichiers servis en ligne portent bien la nouvelle version
  (`index.html`, `app.js`, `langues.js` : 9 clés, 0 ancienne clé).

## Reste ouvert

Rien. La demande est appliquée et en production. Si B veut voir AUSSI les
offres sans remise (au lieu de les voir en fin de liste), c'est une autre
décision — elle ne se prend pas toute seule.
