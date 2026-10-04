/**
 * Application n°2 « Promos » — serveur statique zéro dépendance (Node >= 18).
 * Sert ./public et expose /healthz pour la supervision du hub.
 * Le collecteur écrit data/offres.json ; l'interface le lit en direct.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  // data/offres.json vit un cran au-dessus de public/ : on l'autorise
  // explicitement, sans ouvrir le reste du dossier.
  const fichier = rel === 'data/offres.json' ? DONNEES : path.normalize(path.join(PUBLIC, rel));
  if (fichier !== DONNEES && !fichier.startsWith(PUBLIC)) { res.writeHead(403).end('Forbidden'); return; }

  fs.readFile(fichier, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); res.end('<h1>404</h1>'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(fichier).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => console.log('[promos] interface sur http://' + HOST + ':' + PORT));
