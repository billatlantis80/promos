/* =============================================================================
   LA DISCRÉTION — les épreuves.

   Demande de B (12/10/2026) : « L'objectif est de ne pas trop peser sur le
   système afin d'être discret et d'éviter des problèmes. »

   Trois choses à tenir, et la troisième compte autant que les deux premières :

     1. le compteur de trafic COMPTE (et la taille reçue est celle du fil) ;
     2. `robots.txt` est lu CORRECTEMENT — groupes, `Disallow`, `Crawl-Delay` —
        parce qu'un robots mal lu ferait soit interdire ce qui est permis, soit
        lire ce qui est interdit ;
     3. le verdict publié dit `applique: false`. Un panneau qui laisserait croire
        qu'on suit ces règles alors qu'on ne les suit pas encore serait une
        promesse fausse — c'est la règle du tuyau.
   ============================================================================= */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  reglesRobots, robotsInterdit, tailleRecue, instantaneRobots, blocRobots, bilanDonnees, lireEntete,
} from '../collecteur.mjs';

const source = () => readFileSync(new URL('../collecteur.mjs', import.meta.url), 'utf8');

test('un robots.txt se lit par groupes, et « * » s’applique à nous', () => {
  const r = reglesRobots([
    '# un commentaire',
    'User-agent: Googlebot',
    'Disallow: /rien',
    '',
    'User-agent: *',
    'Disallow: /prive/',
    'Disallow: /panier',
    'Crawl-Delay: 10',
  ].join('\n'));
  assert.equal(r.trouve, true);
  assert.deepEqual(r.chemins, ['/prive/', '/panier']);
  assert.equal(r.delai, 10);
  assert.equal(r.toutInterdit, false);
});

test('un groupe nommé l’emporte sur « * »', () => {
  const r = reglesRobots('User-agent: *\nDisallow: /tout\n\nUser-agent: Kazendra\nDisallow: /juste-ca\n', 'Kazendra');
  assert.deepEqual(r.chemins, ['/juste-ca']);
  assert.equal(r.toutInterdit, false, 'notre propre groupe ne dit pas « tout interdit »');
});

test('deux User-agent qui se suivent partagent leurs règles', () => {
  const r = reglesRobots('User-agent: A\nUser-agent: *\nDisallow: /x\n');
  assert.equal(r.trouve, true);
  assert.deepEqual(r.chemins, ['/x'], 'la règle vaut pour les deux agents du même bloc');
});

test('« Disallow: / » veut dire tout interdit, et « Disallow: » vide ne veut rien dire', () => {
  assert.equal(reglesRobots('User-agent: *\nDisallow: /\n').toutInterdit, true);
  const vide = reglesRobots('User-agent: *\nDisallow:\n');
  assert.equal(vide.toutInterdit, false);
  assert.deepEqual(vide.chemins, [], 'un Disallow vide est une autorisation, pas une interdiction');
});

test('aucun groupe, ou aucun robots : on ne condamne rien', () => {
  assert.equal(reglesRobots('').trouve, false);
  assert.equal(reglesRobots('User-agent: Autre\nDisallow: /\n').trouve, false, 'la règle appartient à un autre agent');
  assert.equal(robotsInterdit({ trouve: false }, '/nimporte'), false);
  assert.equal(robotsInterdit(null, '/nimporte'), false);
});

test('l’interdiction se juge sur le PRÉFIXE du chemin, caractère par caractère', () => {
  const r = reglesRobots('User-agent: *\nDisallow: /prive/\n');
  assert.equal(robotsInterdit(r, '/prive/page'), true);
  assert.equal(robotsInterdit(r, '/public/page'), false, 'un chemin voisin n’est pas interdit');
  // « /prive » ne commence PAS par « /prive/ » : c'est la règle du protocole, et
  // c'est ce que le robots.txt dit réellement. On ne l'interprète pas plus
  // sévèrement qu'écrit — un verdict faux ferait écarter une source à tort.
  assert.equal(robotsInterdit(r, '/prive'), false);
  assert.equal(robotsInterdit(reglesRobots('User-agent: *\nDisallow: /prive\n'), '/prive/page'), true, 'sans barre oblique finale, le préfixe couvre tout ce qui commence pareil');
});

test('la taille comptée est celle du FIL quand le serveur l’annonce', () => {
  const avecAnnonce = { headers: { get: (k) => (k === 'content-length' ? '12345' : null) } };
  assert.equal(tailleRecue(avecAnnonce, 'peu importe'), 12345);
  const sansAnnonce = { headers: { get: () => null } };
  assert.equal(tailleRecue(sansAnnonce, 'ééé'), 6, 'sans annonce, on compte les octets réels du corps (2 octets par « é »)');
});

test('le verdict publié dit NOIR SUR BLANC qu’il n’est pas appliqué', () => {
  const v = instantaneRobots(
    { nouveaux: 3, toutInterdit: ['x.be'], cheminsInterdits: [{ hote: 'y.be', chemin: '/a' }], delais: { 'z.be': 10 } },
    { 'a.be': { trouve: true }, 'b.be': { trouve: false } },
  );
  assert.equal(v.applique, false, 'un panneau ne doit pas laisser croire qu’on suit une règle qu’on ne suit pas');
  assert.match(v.raison, /PAS ENCORE APPLIQUÉ/);
  assert.deepEqual(v.toutInterdit, ['x.be']);
  assert.equal(v.hotesLus, 2, 'les hôtes connus se LISENT dans le cache, ils ne se comptent pas au fil des appels');
  assert.equal(v.sansRobots, 1);
  assert.equal(v.nouveaux, 3, 'le nombre de fichiers réellement lus ce passage');
});

test('lireEntete COUPE la lecture dès la balise : il ne lit pas les 500 Ko qui suivent', async () => {
  const balise = '<meta property="og:image" content="https://exemple.be/a.jpg">';
  const morceaux = [Buffer.from(`<html><head>${balise}`), Buffer.from('x'.repeat(500000))];
  let tires = 0;
  const flux = new ReadableStream({
    pull(c) { if (tires < morceaux.length) c.enqueue(new Uint8Array(morceaux[tires++])); else c.close(); },
  });
  const r = await lireEntete({ body: flux, text: async () => '' });
  assert.equal(r.arrete, true, 'la lecture doit être coupée');
  assert.equal(tires, 1, 'le second morceau ne doit JAMAIS être tiré du serveur');
  assert.ok(r.lu < 100000, `on ne doit pas lire la page entière : ${r.lu} octets`);
  assert.match(r.texte, /og:image/);
});

test('lireEntete s’arrête au plafond quand la balise n’existe pas', async () => {
  const flux = new ReadableStream({
    start(c) { c.enqueue(new Uint8Array(Buffer.from(`${'y'.repeat(300000)}`))); c.close(); },
  });
  const r = await lireEntete({ body: flux, text: async () => '' }, 65536);
  assert.equal(r.arrete, false, 'aucune balise trouvée : rien à couper');
  assert.ok(r.lu <= 300000, 'on ne dépasse pas ce que la page contient');
  assert.equal(r.texte.length, 300000, 'ce qui a été lu reste lisible — sinon on perdrait des visuels');
});

test('le bilan de données publie le trafic mesuré et le verdict robots', () => {
  const b = bilanDonnees({
    connues: new Map(), offres: [], journal: [], maintenant: Date.parse('2026-10-12T12:00:00Z'),
    trafic: {
      passages: 288, requetes: 9400, octets: 1234567890, mo: 1234.6,
      conditionnels: { essais: 500, reutilises: 390 },
      parFamille: { source: { requetes: 9000, octets: 1 } }, hotes: { 'a.be': { requetes: 3, octets: 9 } },
    },
    robots: blocRobots({ hotesLus: 20 }),
  });
  assert.equal(b.trafic.passagesComptes, 288);
  assert.equal(b.trafic.requetes, 9400);
  assert.equal(b.trafic.mo, 1234.6);
  assert.equal(b.trafic.conditionnels.reutilises, 390);
  assert.equal(b.robots.applique, false);
  assert.ok(Object.keys(b.trafic.hotes).length, 'le détail par hôte doit voyager : c’est lui qui dit QUI on sollicite');
});

test('sans mesure fournie, le bilan ne ment pas : des zéros explicites, pas des clés absentes', () => {
  const b = bilanDonnees({ connues: new Map(), offres: [], journal: [] });
  assert.equal(b.trafic.requetes, 0);
  assert.deepEqual(b.trafic.conditionnels, { essais: 0, reutilises: 0 });
  assert.equal(b.robots.applique, false);
});

test('le passage envoie VRAIMENT des requêtes conditionnelles et compte ce qu’il reçoit', () => {
  const src = source();
  assert.match(src, /if-none-match/, 'l’en-tête ETag doit être renvoyé');
  assert.match(src, /if-modified-since/, 'l’en-tête Last-Modified doit être renvoyé');
  assert.match(src, /r\.status === 304 && cache/, 'un 304 doit réutiliser le corps mémorisé, sans le relire');
  assert.match(src, /cacheEcrire\(cle, r\.headers\.get\('etag'\)/, 'les marqueurs sont mémorisés pour la visite suivante');
  assert.match(src, /compterTrafic\(o\.image/, 'les visuels comptent aussi : c’est le plus gros poste');
  assert.match(src, /compterTrafic\(url, 0, 'source-304'\)/, 'un 304 compte une requête et zéro octet');
});

test('les pages d’aperçu sont lues EN FLUX et coupées dès la balise trouvée', () => {
  const src = source();
  assert.match(src, /\.getReader\(\)/, 'la réponse se lit en flux, morceau par morceau');
  assert.match(src, /lecteur\.cancel\(\)/, 'on COUPE la lecture : c’est ça qui évite de payer la fin de la page');
  assert.match(src, /BUDGET_ENTETE = 65536/, 'un plafond de lecture subsiste, pour les pages sans balise');
  // ⚠ La requête partielle a été ESSAYÉE puis RETIRÉE : la mesure a montré
  // qu'une réponse 206 n'est pas compressée, donc qu'elle coûte parfois plus
  // cher que la page entière en gzip. On vérifie qu'elle ne revient pas.
  assert.doesNotMatch(src, /range: 'bytes=/, 'la requête partielle a été mesurée comme perdante : elle ne doit pas revenir sans une nouvelle mesure');
});

test('le bilan publie le compte des lectures coupées', () => {
  const b = bilanDonnees({
    connues: new Map(), offres: [], journal: [],
    trafic: { apercu: { demandes: 37, ecourtees: 30, entieres: 7 } },
  });
  assert.equal(b.trafic.apercu.demandes, 37);
  assert.equal(b.trafic.apercu.ecourtees, 30);
  const vide = bilanDonnees({ connues: new Map(), offres: [], journal: [] });
  assert.deepEqual(vide.trafic.apercu, { demandes: 0, ecourtees: 0, entieres: 0 });
});
