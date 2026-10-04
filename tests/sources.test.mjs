/**
 * Contrôles des SOURCES et de la RÉCOLTE — application n°2 « Promos ».
 *
 * Deux plaintes de l'utilisateur ont déclenché ces vérifications :
 *
 *   1. « il n'y avait pas beaucoup de résultats pour certains pays » —
 *      cause trouvée : le filtre de pertinence était ÉCRIT EN FRANÇAIS et
 *      appliqué à toutes les presses. Un titre suédois, polonais ou portugais
 *      n'avait aucune chance de passer. Mesuré : 0 à 5 titres retenus sur 100
 *      avec le filtre français, 70 à 97 avec le filtre dans la bonne langue.
 *      DEUXIÈME cause : la veille était plafonnée à 200 articles TOUS PAYS
 *      CONFONDUS, budget que la France consommait à elle seule.
 *
 *   2. « dans certains pays il n'y a pas d'images » — les flux d'actualité n'en
 *      fournissent aucune (0 sur 100, onze pays sur douze). On va donc les
 *      chercher dans la page de l'article (og:image), avec des garde-fous :
 *      le « visuel » d'un site est souvent son logo, identique partout.
 *
 * Ces tests EXÉCUTENT le code du collecteur (import de ses fonctions) au lieu
 * de relire le fichier : chercher une chaîne ne prouverait rien.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { TOUTES_SOURCES, MOTS_PROMO, motsPromo, ecarterTuiles, veilleParPays, lienReel, dedupliquerArticles, BUDGET_CRON, LIMITE_CRON_MS, PAYS_PRESSE, PAYS_BING }
  from '../collecteur.mjs';

/* ---------------------------------------------------------------------------
 * 1. Le filtre parle la langue de la source
 * ------------------------------------------------------------------------- */

// Titres RÉELS relevés dans les flux lors de la mesure (sondes des pays les plus
// mal servis). Ce ne sont pas des exemples inventés : ce sont ceux qui ont décidé
// de la correction.
//
// On raisonne sur un FAISCEAU, jamais sur un titre isolé : « tel titre passe ou
// ne passe pas » dépend des mots qu'il contient, et une assertion par titre
// deviendrait fausse au premier article rédigé autrement. Ce qui est vrai et
// vérifiable, c'est : le filtre de la langue les retient TOUS, et le filtre
// français en LAISSE ÉCHAPPER au moins un — sur un flux entier, il en laissait
// échapper 95 à 100.
const TITRES_REELS = {
  fr: ['Bon plan : les écouteurs Nothing Ear (3) chutent à 96 € au lieu de 179 €'],
  nl: ['Bol 10-daagse: welke promoties zijn écht de moeite?',
    'Repareren is goedkoper, vervangen hoeft lang niet altij'],
  de: ['Preissturz bei Lidl-Duftzwillingen – Dupes von Dior',
    'So günstig wie nie bei Amazon: Samsung Galaxy Watch9 im Angebot'],
  es: ['Zara rebaja su cazadora acolchada más especial para',
    'TCL C7L SQD-Mini LED desde 652 euros: gran descuento'],
  it: ['Pixel 10a, Google aumenta il prezzo ma Amazon lo taglia',
    'Nothing Phone (3a) 5G a 250€ su AliExpress con coupon'],
  pt: ['É amanhã: 20 melhores ofertas Prime antecipadas com descontos',
    'Amazon Prime Day 2026: As melhores ofertas em tecnologia'],
  pl: ['Bez CPN, kilkadziesiąt złotych taniej na paliwie',
    'Action rozpieszcza fanów taniej elektroniki. Mnóstwo'],
  sv: ['Novo sänker priset på Wegovy i Sverige',
    'Säljes: Ny Uttern D77 White Mercury 250 V8 - Höst Kampanj'],
  en: ['Best Biking Deals of the Week – 2nd October 2026',
    'Will Kindles be on sale during October Prime Day?'],
};

test('chaque langue retient TOUS les vrais titres de promotion de sa langue', () => {
  for (const [langue, titres] of Object.entries(TITRES_REELS)) {
    for (const titre of titres) {
      assert.match(
        titre, MOTS_PROMO[langue],
        `le filtre « ${langue} » doit retenir : « ${titre} »`,
      );
    }
  }
});

test('le filtre français laisse échapper de vraies promotions étrangères', () => {
  // C'est la PREUVE du défaut, pas une coquetterie : ces titres sont de vraies
  // promotions, et l'ancien filtre — français pour tout le monde — les jetait.
  // Sans cette vérification, on pourrait « corriger » en remettant un filtre
  // unique sans que rien ne le signale.
  //
  // L'anglais est volontairement absent : ses mots (« deal », « sale ») figurent
  // déjà dans la liste française, et c'est exactement pourquoi l'Irlande avait
  // des résultats quand la Suède n'en avait aucun.
  for (const langue of ['es', 'it', 'pt', 'pl', 'sv', 'de', 'nl']) {
    const echappes = TITRES_REELS[langue].filter((t) => !MOTS_PROMO.fr.test(t));
    assert.ok(
      echappes.length > 0,
      `le filtre français ne doit pas suffire au « ${langue} » : il retient tout, `
      + 'donc la correction par langue ne servirait à rien',
    );
  }
});

test('motsPromo() rend bien le filtre de LA source, jamais un défaut muet', () => {
  assert.equal(motsPromo({ langue: 'sv' }), MOTS_PROMO.sv);
  assert.equal(motsPromo({ langue: 'pl' }), MOTS_PROMO.pl);
  // Le défaut français existe pour les appels sans source — mais aucune source
  // ne doit s'y fier : le test suivant le vérifie.
  assert.equal(motsPromo({}), MOTS_PROMO.fr);
});

/* ---------------------------------------------------------------------------
 * 2. Toute source déclare son pays ET sa langue
 * ------------------------------------------------------------------------- */

test('toutes les sources déclarent un pays et une langue', () => {
  const sansPays = TOUTES_SOURCES.filter((s) => !s.pays).map((s) => s.id);
  const sansLangue = TOUTES_SOURCES.filter((s) => !s.langue).map((s) => s.id);
  assert.deepEqual(sansPays, [], `sources sans pays : ${sansPays.join(', ')}`);
  assert.deepEqual(
    sansLangue, [],
    `sources sans langue : ${sansLangue.join(', ')} — le filtre retomberait en `
    + 'silence sur le français, et viderait une presse étrangère',
  );
  const langueInconnue = TOUTES_SOURCES
    .filter((s) => s.langue && !MOTS_PROMO[s.langue]).map((s) => `${s.id}(${s.langue})`);
  assert.deepEqual(langueInconnue, [], `langues sans filtre : ${langueInconnue.join(', ')}`);
});

test('aucune source ne porte de drapeau mort', () => {
  // `aTrier` était déclaré sur toutes les sources de presse… et jamais lu par
  // personne : il laissait croire que certains flux échappaient au filtre de
  // pertinence, alors que TOUS y passaient. Un réglage qui ne fait rien est un
  // mensonge posé dans le code.
  const drapeaux = [...new Set(TOUTES_SOURCES.flatMap((s) => Object.keys(s)))];
  assert.ok(!drapeaux.includes('aTrier'), 'le drapeau « aTrier » ne doit plus exister');
});

test('les identifiants de source sont uniques', () => {
  const ids = TOUTES_SOURCES.map((s) => s.id);
  const doublons = ids.filter((x, i) => ids.indexOf(x) !== i);
  assert.deepEqual(doublons, [], `identifiants en double : ${doublons.join(', ')}`);
});

/* ---------------------------------------------------------------------------
 * 3. Le volume : trois requêtes par pays et par langue
 * ------------------------------------------------------------------------- */

test('chaque couple pays/langue a au moins trois requêtes de presse', () => {
  const compte = {};
  for (const p of PAYS_PRESSE) {
    const cle = `${p.pays}/${p.langue}`;
    compte[cle] = p.requetes.length;
  }
  const maigres = Object.entries(compte).filter(([, n]) => n < 3).map(([k, n]) => `${k}:${n}`);
  assert.deepEqual(
    maigres, [],
    `couples pays/langue à moins de trois requêtes : ${maigres.join(', ')} — `
    + 'une seule requête laissait ces pays visiblement à sec',
  );
  // Les requêtes doivent être écrites dans la langue du pays : une requête
  // française avec gl=DE ramène du bruit. Contrôle grossier mais utile.
  const accents = { fr: /é|è|ê|à|ç/u, de: /ä|ü|ö|ß|Angebot|Rabatt|Schnäppchen/u, sv: /å|ä|ö/u };
  for (const p of PAYS_PRESSE) {
    if (accents[p.langue]) {
      const ecrites = p.requetes.filter((q) => accents[p.langue].test(decodeURIComponent(q)));
      assert.ok(
        ecrites.length > 0,
        `les requêtes ${p.pays}/${p.langue} ne semblent pas écrites dans la langue du pays`,
      );
    }
  }
});

/* ---------------------------------------------------------------------------
 * 4. Le plafond de veille est PAR PAYS
 * ------------------------------------------------------------------------- */

test('le plafond de veille ne laisse aucun pays se faire affamer', () => {
  // 300 articles français et 2 suédois, plafond 10. Avec l'ancien plafond
  // GLOBAL de 200, les deux Suédois survivaient par chance ; avec un plafond
  // global plus petit, ils disparaissaient. En par-pays, chaque pays garde son
  // dû — c'est tout l'objet de la correction.
  const liste = [
    ...Array.from({ length: 300 }, (_, i) => ({ pays: 'FR', id: 'fr' + i })),
    ...Array.from({ length: 2 }, (_, i) => ({ pays: 'SE', id: 'se' + i })),
  ];
  const gardees = veilleParPays(liste, 10);
  const parPays = {};
  for (const o of gardees) parPays[o.pays] = (parPays[o.pays] || 0) + 1;
  assert.equal(parPays.FR, 10, 'le pays bavard doit être plafonné');
  assert.equal(parPays.SE, 2, 'le pays discret doit garder TOUT ce qu’il a');
});

test('le plafond garde les articles les plus récents de chaque pays', () => {
  // La liste arrive triée du plus récent au plus ancien : le plafond doit
  // couper la queue, pas la tête.
  const liste = [
    { pays: 'IT', id: 'récent' }, { pays: 'IT', id: 'milieu' }, { pays: 'IT', id: 'vieux' },
  ];
  const gardees = veilleParPays(liste, 2);
  assert.deepEqual(gardees.map((o) => o.id), ['récent', 'milieu']);
});

/* ---------------------------------------------------------------------------
 * 5. Les visuels : refuser une image qui n'en est pas une
 * ------------------------------------------------------------------------- */

test('une image répétée sur plusieurs articles est écartée et retenue', () => {
  // Le piège mesuré : sur certains sites, og:image renvoie la MÊME tuile pour
  // tous les articles (le logo du journal, ou une image de profil Facebook).
  // Quarante cartes avec le même logo ressemblent à une réussite et n'en sont
  // pas une — c'est même pire qu'une carte neutre, qui au moins ne ment pas.
  const offres = [
    { pays: 'IE', image: 'https://exemple.ie/logo.png' },
    { pays: 'IE', image: 'https://exemple.ie/logo.png' },
    { pays: 'IE', image: 'https://exemple.ie/logo.png' },
    { pays: 'IE', image: 'https://exemple.ie/article-1.jpg' },
    { pays: 'IE', image: 'https://exemple.ie/article-2.jpg' },
    { pays: 'IE', image: '' },
  ];
  const retenues = new Set();
  const retires = ecarterTuiles(offres, retenues);
  assert.equal(retires, 3, 'les trois articles portant la tuile doivent perdre leur visuel');
  assert.ok(retenues.has('https://exemple.ie/logo.png'), 'la tuile doit être retenue pour la suite');
  assert.equal(offres[3].image, 'https://exemple.ie/article-1.jpg', 'un vrai visuel d’article reste');
  assert.equal(offres[5].image, '', 'une offre sans visuel reste sans visuel');
});

test('deux articles qui partagent une image gardent leur visuel', () => {
  // Le seuil est à trois : deux articles d'un même site peuvent réellement
  // illustrer le même produit. Écarter dès deux retirerait de vrais visuels.
  const offres = [
    { pays: 'PT', image: 'https://exemple.pt/a.jpg' },
    { pays: 'PT', image: 'https://exemple.pt/a.jpg' },
  ];
  const retenues = new Set();
  assert.equal(ecarterTuiles(offres, retenues), 0);
  assert.equal(retenues.size, 0);
});

test('une image déjà écartée ne revient pas au passage suivant', () => {
  const retenues = new Set(['https://exemple.se/tuile.jpg']);
  const offres = [
    { pays: 'SE', image: 'https://exemple.se/tuile.jpg' },
    { pays: 'SE', image: 'https://exemple.se/tuile.jpg' },
    { pays: 'SE', image: 'https://exemple.se/tuile.jpg' },
  ];
  assert.equal(ecarterTuiles(offres, retenues), 3);
  assert.ok(retenues.has('https://exemple.se/tuile.jpg'));
});

/* ---------------------------------------------------------------------------
 * 6. Bing : le lien de l'éditeur est CACHÉ dans un redirecteur
 * ------------------------------------------------------------------------- */

test('lienReel() sort l’adresse de l’éditeur du redirecteur Bing', () => {
  // Bing écrit « &amp;url= » : un motif « [?&]url= » appliqué SANS dé-échapper ne
  // trouve rien, et on croit que Bing ne donne pas le lien direct. Piège payé à
  // la sonde n°6 — vérifié ici pour qu'il ne revienne pas.
  const bing = 'http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=&amp;tid=abc'
    + '&amp;url=https%3a%2f%2fwww.ginjfo.com%2fpromos%2fbon-plan-nzxt&amp;c=123&amp;mkt=fr-BE';
  assert.equal(
    lienReel(bing), 'https://www.ginjfo.com/promos/bon-plan-nzxt',
    'le lien doit pointer chez l’éditeur, pas chez bing.com',
  );
  // Un lien ordinaire traverse sans être abîmé — y compris s'il porte lui-même
  // un paramètre « url= » qui n'a rien à voir avec Bing.
  assert.equal(lienReel('https://www.dealabs.com/bons-plans/x'), 'https://www.dealabs.com/bons-plans/x');
  assert.equal(lienReel(''), '');
});

test('Bing est branché pour tous les pays, et sans doublon', () => {
  const couples = PAYS_BING.map((p) => `${p.pays}/${p.langue}`);
  assert.equal(new Set(couples).size, couples.length, 'couples pays/langue de Bing en double');
  const maigres = PAYS_BING.filter((p) => p.requetes.length < 2).map((p) => p.pays);
  assert.deepEqual(maigres, [], `pays sans assez de requêtes Bing : ${maigres.join(', ')}`);
  // Chaque couple doit avoir un marché Bing (mkt) : sans lui, Bing rend des
  // résultats d'un autre pays (constaté : une requête portugaise a ramené un
  // site brésilien).
  const sansMarche = PAYS_BING.filter((p) => !/^[a-z]{2}-[A-Z]{2}$/.test(p.mkt)).map((p) => p.pays);
  assert.deepEqual(sansMarche, [], `pays sans marché Bing valide : ${sansMarche.join(', ')}`);
  const sources = TOUTES_SOURCES.filter((s) => s.id.startsWith('bing-'));
  assert.ok(sources.length >= PAYS_BING.length, 'les sources Bing doivent être branchées');
  assert.ok(
    sources.every((s) => s.reposMin >= 15),
    'les sources Bing doivent prendre du repos',
  );
});

/* ---------------------------------------------------------------------------
 * 7. Le même article ne s'affiche pas deux fois
 * ------------------------------------------------------------------------- */

test('un article arrivé par Google News ET par Bing n’est gardé qu’une fois', () => {
  // Les deux chemins donnent des liens DIFFÉRENTS (news.google.com d'un côté,
  // l'éditeur de l'autre) : la clé d'unicité ne les rapproche pas. Sans ce
  // dédoublonnage, chaque article de Bing apparaissait en double.
  const liste = [
    { type: 'article', titre: 'Bon plan : les écouteurs Nothing Ear', lienPage: 'https://news.google.com/rss/articles/AAA', image: '' },
    { type: 'article', titre: 'Bon plan : les écouteurs Nothing Ear', lienPage: 'https://exemple.be/bon-plan-nothing-ear', image: 'https://exemple.be/a.jpg' },
  ];
  const gardees = dedupliquerArticles(liste);
  assert.equal(gardees.length, 1, 'une seule fiche pour un seul article');
  assert.equal(gardees[0].image, 'https://exemple.be/a.jpg', 'on garde la fiche AVEC visuel');
  assert.equal(gardees[0].lienPage, 'https://exemple.be/bon-plan-nothing-ear', 'et le lien de l’éditeur');
});

test('deux offres marchandes au même titre ne sont jamais fusionnées', () => {
  // Deux boutiques peuvent porter le même titre. Les fusionner ferait
  // disparaître une offre réelle — on ne dédoublonne QUE les articles.
  const liste = [
    { type: 'offre', titre: 'AirPods Pro 3', lienPage: 'https://a.example/x' },
    { type: 'offre', titre: 'AirPods Pro 3', lienPage: 'https://b.example/y' },
  ];
  assert.equal(dedupliquerArticles(liste).length, 2);
});

test('deux articles de titres différents sont tous les deux gardés', () => {
  const liste = [
    { type: 'article', titre: 'Bon plan Écouteurs', lienPage: 'https://a.example/1' },
    { type: 'article', titre: 'Promo casque Sony', lienPage: 'https://b.example/2' },
  ];
  assert.equal(dedupliquerArticles(liste).length, 2);
});

/* ---------------------------------------------------------------------------
 * 8. La collecte doit tenir dans le temps que le planificateur accorde
 * ------------------------------------------------------------------------- */

test('la collecte tient dans le délai que le planificateur accorde', () => {
  // Défaut vécu, pas théorique : « Script timed out after 120s ». Les délais
  // vivaient éparpillés dans le code — 90 s pour la recherche des visuels, et
  // RIEN pour leur téléchargement. Leur somme dépassait la limite, et le passage
  // était tué EN PLEINE ÉCRITURE : le fichier publié n'était pas écrit, donc le
  // site ne se mettait pas à jour. Une fois par demi-heure seulement, quand
  // toutes les sources se rafraîchissent ensemble — le genre de panne qui passe
  // pour un hoquet passager.
  const total = Object.values(BUDGET_CRON).reduce((a, b) => a + b, 0);
  assert.ok(
    total <= LIMITE_CRON_MS,
    `la somme des délais bornés (${total} ms) doit tenir sous la limite du planificateur (${LIMITE_CRON_MS} ms)`,
  );
  const marge = LIMITE_CRON_MS - total;
  assert.ok(
    marge >= 15000,
    `il faut garder de la marge pour la collecte réseau et l'envoi Git — reste ${marge} ms`,
  );
  // Aucun délai muet : c'est précisément l'absence d'échéance sur les
  // téléchargements qui a fait dépasser la limite.
  for (const [nom, ms] of Object.entries(BUDGET_CRON)) {
    assert.ok(Number.isFinite(ms) && ms > 0, `le délai « ${nom} » doit être un nombre positif`);
  }
});
