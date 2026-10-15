/**
 * Application n°2 « Promos » — serveur statique zéro dépendance (Node >= 18).
 * Sert ./public et expose /healthz pour la supervision du hub.
 * Le collecteur écrit data/offres.json ; l'interface le lit en direct.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERDICTS_FICHIER, lireVerdicts, enregistrerDecision, ecrireVerdicts } from './verdicts-de-la-main.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const RACINE = __dirname;
const DONNEES = path.join(RACINE, 'data', 'offres.json');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

/* Domaines dont on accepte de relayer le visuel (aucun proxy ouvert).
   DÉFAUT CORRIGÉ DEUX FOIS : cette liste avait d'abord été écrite de mémoire
   (il manquait les trois plus gros pourvoyeurs → cartes grises), puis laissée
   figée à la main — si bien que **toute nouvelle source** ramenant un nouveau
   domaine voyait ses visuels refusés par NOTRE serveur, déguisé en panne de la
   source. Elle n'est donc plus maintenue à la main : elle est DÉRIVÉE des URL
   réellement présentes dans data/offres.json (recalculée quand le fichier
   change). Ce n'est pas un proxy ouvert : seuls les domaines que notre propre
   collecteur a vus passer sont acceptés. La liste ci-dessous ne sert plus que
   de secours quand le fichier est absent ou en cours d'écriture. */
const HÔTES_SECOURS = [
  // Dealabs (pepper = CDN des offres, www = visuel par défaut)
  'static-pepper.dealabs.com', 'www.dealabs.com', 'pepper.dealabs.com',
  // Les Numériques
  'cdn.lesnumeriques.com', 'media.lesnumeriques.com', 'www.lesnumeriques.com',
  // Clubic
  'pic.clubic.com', 'www.clubic.com',
  // Presse tech
  'www.01net.com', 'images.frandroid.com', 'www.frandroid.com',
  'www.journaldugeek.com', 'www.presse-citron.net',
  // Amazon (visuels produits)
  'images-eu.ssl-images-amazon.com', 'm.media-amazon.com',
];
const UA_IMAGE = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

let cacheHôtes = { mtime: 0, hôtes: null };

/** Domaines présents dans nos données + liste de secours. */
function domainesAutorises() {
  let mtime = 0;
  try { mtime = fs.statSync(DONNEES).mtimeMs; } catch { /* pas encore collecté */ }
  if (cacheHôtes.hôtes && cacheHôtes.mtime === mtime) return cacheHôtes.hôtes;
  const trouves = new Set();
  try {
    const d = JSON.parse(fs.readFileSync(DONNEES, 'utf8'));
    for (const o of d.offres || []) {
      if (!o.image) continue;
      try { trouves.add(new URL(o.image).hostname.toLowerCase()); } catch { /* URL invalide */ }
    }
  } catch { /* fichier en cours d'écriture : on garde la liste de secours */ }
  cacheHôtes = { mtime, hôtes: trouves };
  return trouves;
}

function hôteAutorisé(hote) {
  hote = String(hote || '').toLowerCase();
  if (!hote) return false;
  if (domainesAutorises().has(hote)) return true;
  // Sous-domaines d'un domaine de secours (ex. www. d'un CDN listé).
  return HÔTES_SECOURS.some((h) => hote === h || hote.endsWith('.' + h));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

  if (url.pathname === '/healthz') {
    let offres = null;
    try { offres = JSON.parse(fs.readFileSync(DONNEES, 'utf8')).total; } catch { /* pas encore collecté */ }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, name: 'promos', pid: process.pid, offres }));
    return;
  }

  // /api/offres : même fichier que l'interface, exposé pour un usage programmé.
  if (url.pathname === '/api/offres') {
    fs.readFile(DONNEES, (err, data) => {
      if (err) { res.writeHead(503, { 'content-type': 'application/json' }); res.end('{"offres":[]}'); return; }
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
      res.end(data);
    });
    return;
  }

  /* /api/verdict-carte : LES DEUX GESTES DE LA MAIN (demande de B, 15/10/2026).
     « Le premier bouton efface la ligne [...] et définitivement du système [...]
     Le deuxième bouton me permet de réactiver une annonce pour 1, 2, 3, 4 et 5
     jours, manuellement et la faire réapparaître sur le site. »

     POURQUOI UNE ROUTE ICI, ET PAS SEULEMENT DANS LE PANNEAU. Le panneau est une
     page publiée : il peut montrer, il ne peut pas écrire sur la machine qui
     collecte. Sans cette route, les deux boutons n'écriraient que dans le
     navigateur de la tablette — et une décision qui ne quitte pas l'appareil ne
     décide rien. C'est la « promesse fausse » déjà payée sur ce projet.

     CE QUE ÇA ÉCRIT : `public/verdicts-a-la-main.json`, un fichier PUBLIÉ AVEC LE
     SITE. La collecte le relit à chaque passage (≤ 15 min) et l'applique : la
     carte sort du système, ou revient sur le site. Comme il est publié, la
     décision survit à un dépôt recloné et au secours horaire.

     LE GARDE-FOU, ET CE QU'IL VAUT VRAIMENT. L'écriture exige l'en-tête
     `X-Panneau` : une page tierce ne peut pas le poser sans autorisation
     d'origine croisée, et on n'en donne aucune. Ce n'est donc PAS une
     authentification — c'est un garde-fou contre une page web quelconque, pas
     contre quelqu'un qui aurait déjà accès au réseau de la machine. Le dire vaut
     mieux que de laisser croire à un cadenas. */
  if (url.pathname === '/api/verdict-carte') {
    /* ⚠ UN REFUS SE DIT SANS CASSER LA CONNEXION, ET C'EST UNE MESURE, PAS DU ZÈLE.
     *  Un serveur qui renvoie « non » sans avoir vidé la requête laisse Node fermer
     *  la connexion ; si le client la réutilise (c'est ce que fait `fetch`), sa
     *  requête SUIVANTE échoue en « fetch failed » — c'est-à-dire « la machine n'a
     *  pas répondu », alors qu'elle a répondu et refusé. C'est exactement la
     *  distinction que le panneau doit tenir (« refusé » ≠ « injoignable »), et
     *  l'épreuve l'a attrapée en la mesurant : le même enchaînement passait ou
     *  cassait selon l'instant. On vide donc l'entrant AVANT de répondre, en
     *  répondant tout de suite si le corps est déjà entièrement lu — sinon on
     *  attendrait un événement déjà passé, et la requête resterait sans réponse. */
    const refuser = (code, message) => {
      // ⚠ ON VIDE L'ENTRANT AVANT DE RÉPONDRE « NON », et sans écrire deux fois :
      //  une réponse de refus qui laisse la requête non lue se termine par une
      //  connexion cassée, que `fetch` traduit en « la machine n'a pas répondu » —
      //  l'inverse d'un refus. `resume()` draine et la connexion reste utilisable.
      req.resume();
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
      res.end(message);
    };
    if (req.method !== 'POST') {
      refuser(405, '{"ok":false,"erreur":"POST attendu"}');
      return;
    }
    if (req.headers['x-panneau'] !== '1') {
      refuser(403, '{"ok":false,"erreur":"écriture réservée au panneau du projet"}');
      return;
    }
    let corps = '';
    let trop = false;
    // Un corps hors borne est REFUSÉ, jamais avalé : dès qu'on dépasse, on cesse
    // d'accumuler (la mémoire reste bornée) et on laisse filer les octets restants
    // pour pouvoir RÉPONDRE 413 — détruire la requête ferait afficher « la machine
    // n'a pas répondu » au lieu de « refusé », la confusion qu'on vient d'écarter.
    req.on('data', (morceau) => {
      if (trop) return;
      corps += morceau;
      if (corps.length > 16384) { trop = true; corps = ''; }
    });
    req.on('end', () => {
      if (trop) { res.writeHead(413, { 'content-type': 'application/json; charset=utf-8' }); res.end('{"ok":false,"erreur":"décision trop longue"}'); return; }
      try {
        const demande = JSON.parse(corps || '{}');
        const fichier = path.join(RACINE, VERDICTS_FICHIER);
        const avant = lireVerdicts(fichier);
        const apres = enregistrerDecision(avant, demande);
        ecrireVerdicts(fichier, apres);
        console.log(`[promos] décision de la main : ${demande.action} ${demande.cle}${demande.jours ? ` (${demande.jours} j)` : ''}`);
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify({
          ok: true, action: demande.action, cle: demande.cle,
          jusquau: demande.action === 'reactiver' ? apres.reactivees[demande.cle].jusquau : null,
          // ⚠ LES DEUX COMPTES PORTENT LEURS VRAIS NOMS. `supprimees` est resté ici
          //  après que le geste est devenu « vérifier » : `Object.keys(undefined)`
          //  levait DANS la réponse, après l'envoi des en-têtes — le serveur
          //  mourait en pleine réponse, et le panneau lisait « la machine n'a pas
          //  répondu » au lieu du refus ou du succès. Trouvé par l'épreuve, qui
          //  exige désormais la FORME du corps et pas seulement son code.
          verifiees: Object.keys(apres.verifiees).length,
          reactivees: Object.keys(apres.reactivees).length,
          fichier: VERDICTS_FICHIER,
        }));
      } catch (e) {
        res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, erreur: String(e && e.message || e) }));
      }
    });
    return;
  }

  // /img?u=… : les visuels des offres vivent chez les sources. Servis tels quels,
  // le navigateur les refuse (politique d'origine croisée du proxy du hub :
  // ERR_BLOCKED_BY_RESPONSE.NotSameOrigin — les cartes restaient grises). On les
  // récupère donc côté serveur et on les rend SAME-ORIGIN. Liste de domaines
  // autorisés : jamais de proxy ouvert, ce serait un relais à la disposition de
  // n'importe qui.
  if (url.pathname === '/img') {
    const cible = url.searchParams.get('u') || '';
    let hote = '';
    try { hote = new URL(cible).hostname; } catch { /* URL invalide */ }
    if (!hôteAutorisé(hote)) { res.writeHead(403).end('Domaine non autorisé'); return; }
    fetch(cible, { headers: { 'user-agent': UA_IMAGE, 'referer': 'https://' + hote + '/' } })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const type = r.headers.get('content-type') || 'image/jpeg';
        if (!type.startsWith('image/')) throw new Error('pas une image');
        return r.arrayBuffer().then((buf) => {
          res.writeHead(200, { 'content-type': type, 'cache-control': 'public, max-age=86400' });
          res.end(Buffer.from(buf));
        });
      })
      .catch(() => { res.writeHead(502).end('Visuel indisponible'); });
    return;
  }

  const PUBLIC = path.join(RACINE, 'public');
  const DOCS = path.join(RACINE, 'docs');
  // Un dossier vaut son index.html. GitHub Pages le fait (et redirige même
  // /admin vers /admin/), le service local ne le faisait pas : le panneau
  // d'administration répondait 404 ici pendant qu'il fonctionnerait en ligne.
  // Un serveur de test qui ne se comporte pas comme la cible fait perdre plus
  // de temps qu'il n'en fait gagner.
  let chemin = url.pathname;
  if (chemin === '/') chemin = '/index.html';
  else if (chemin.endsWith('/')) chemin += 'index.html';
  const rel = chemin.replace(/^\/+/, '');
  // Trois familles de fichiers, chacune dans son dossier :
  //   - data/offres.json vit un cran au-dessus de public/ : autorisé nommément ;
  //   - les visuels publiés vivent dans docs/img/ : les offres publiées les
  //     référencent en chemin relatif, mais le service local sert public/ — donc
  //     ces fichiers n'y étaient pas et TOUS les visuels répondaient 404 (cartes
  //     grises en local pendant que le site publié, lui, les affichait) ;
  //   - tout le reste vient de public/.
  let fichier;
  if (rel === 'data/offres.json') fichier = DONNEES;
  // Le site publié sert le catalogue à la RACINE (/offres.json) : c'est ce que
  // lit le panneau d'administration, depuis /admin/. Sans cette ligne, le
  // panneau s'ouvrait sur un tableau de bord VIDE en local alors qu'il
  // fonctionnerait en ligne — le pire des deux mondes pour mettre au point.
  else if (rel === 'offres.json') fichier = DONNEES;
  // Le TÉMOIN DE FRAÎCHEUR vit dans docs/ (il n'est pas dans public/ : c'est un
  // fichier de publication). Sans cette ligne, le panneau ouvert en local ne le
  // trouvait pas — l'onglet Exploitation annonçait « aucun bilan publié » ici
  // alors qu'il est rempli en ligne. Un serveur de test qui ne se comporte pas
  // comme la cible fait perdre plus de temps qu'il n'en fait gagner.
  else if (rel === 'etat-collecte.json') fichier = path.join(DOCS, rel);
  // LE SUIVI DES CARTES (effacées, bloquées) est un fichier de contrôle produit
  // à la publication, sans jumeau dans public/ — même famille que le témoin de
  // fraîcheur juste au-dessus. Sans cette ligne, l'onglet « Vie des cartes »
  // s'ouvrirait sur « fichier absent » en local pendant qu'il est rempli en
  // ligne : un serveur de test qui ne se comporte pas comme la cible fait perdre
  // plus de temps qu'il n'en fait gagner (défaut déjà payé deux fois ici).
  else if (rel === 'suivi-cartes.json') fichier = path.join(DOCS, rel);
  else if (rel.startsWith('img/')) fichier = path.normalize(path.join(DOCS, rel));
  else fichier = path.normalize(path.join(PUBLIC, rel));

  const racines = [DONNEES, PUBLIC, DOCS];
  if (!racines.some((d) => fichier === d || fichier.startsWith(d + path.sep))) {
    res.writeHead(403).end('Forbidden'); return;
  }

  fs.readFile(fichier, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); res.end('<h1>404</h1>'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(fichier).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => console.log('[promos] interface sur http://' + HOST + ':' + PORT));
