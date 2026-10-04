/**
 * Contrôles du compte local — application n°2 « Promos ».
 *
 * Ces tests portent sur le module lui-même, pas sur l'écran : ils vérifient ce
 * qui compte vraiment pour l'utilisateur, à savoir qu'un mot de passe mal saisi
 * est refusé, qu'un bon mot de passe est accepté, et surtout que le mot de passe
 * n'est JAMAIS écrit dans le stockage.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = fs.readFileSync(path.join(ICI, '..', 'public', 'compte.js'), 'utf8');

/* Ce que l'application utilise comme stockage : un objet qui imite localStorage.
   Les modules ES sont importés une seule fois : on installe le faux stockage
   AVANT l'import, en passant par une URL avec marqueur pour repartir propre. */
const memoire = new Map();
globalThis.localStorage = {
  getItem: (k) => (memoire.has(k) ? memoire.get(k) : null),
  setItem: (k, v) => memoire.set(k, String(v)),
  removeItem: (k) => memoire.delete(k),
  clear: () => memoire.clear(),
};
globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');

const C = await import(`../public/compte.js?test=${Date.now()}`);

test('le stockage ne contient jamais le mot de passe en clair', async () => {
  memoire.clear();
  await C.creerCompte('Utilisateur', 'MotDePasseSolide1');
  const brut = [...memoire.values()].join(' ');
  assert.ok(!brut.includes('MotDePasseSolide1'), 'le mot de passe ne doit apparaître nulle part dans le stockage');
  assert.match(brut, /PBKDF2-SHA256/, 'l’algorithme employé doit être nommé');
  assert.match(brut, /empreinte/, 'une empreinte doit être conservée');
});

test('le bon mot de passe ouvre, le mauvais est refusé', async () => {
  memoire.clear();
  await C.creerCompte('Utilisateur', 'MotDePasseSolide1');
  assert.equal((await C.verifierMotDePasseCompte('MotDePasseSolide1')).ok, true);
  assert.equal((await C.verifierMotDePasseCompte('motdepassesolide1')).ok, false, 'la casse compte');
  assert.equal((await C.verifierMotDePasseCompte('')).ok, false);
});

test('deux comptes avec le même mot de passe n’ont pas la même empreinte', async () => {
  // Sans sel aléatoire, deux utilisateurs partageant un mot de passe auraient la
  // même empreinte : la fuite de l'un révélerait l'autre.
  memoire.clear();
  await C.creerCompte('Utilisateur', 'MotDePasseSolide1');
  const une = JSON.parse(memoire.get('promos.compte')).empreinte;
  memoire.clear();
  await C.creerCompte('Utilisateur', 'MotDePasseSolide1');
  const deux = JSON.parse(memoire.get('promos.compte')).empreinte;
  assert.notEqual(une, deux, 'le sel doit rendre chaque empreinte unique');
});

test('inscription : les règles annoncées sont appliquées', async () => {
  memoire.clear();
  assert.equal((await C.creerCompte('ab', 'MotDePasseSolide1')).ok, false, 'nom trop court');
  assert.equal((await C.creerCompte('nom avec espaces', 'MotDePasseSolide1')).ok, false, 'caractères interdits');
  assert.equal((await C.creerCompte('Utilisateur', 'court')).ok, false, 'mot de passe trop court');
  assert.equal((await C.creerCompte('Utilisateur', '1234567890')).ok, false, 'que des chiffres');
  assert.equal((await C.creerCompte('Utilisateur', 'MotDePasseSolide1')).ok, true);
});

test('changer le mot de passe exige l’ancien', async () => {
  memoire.clear();
  await C.creerCompte('Utilisateur', 'MotDePasseSolide1');
  assert.equal((await C.changerMotDePasse('faux', 'AutreMotDePasse2')).ok, false, 'un mauvais ancien doit être refusé');
  assert.equal((await C.verifierMotDePasseCompte('MotDePasseSolide1')).ok, true, 'l’ancien doit rester valable après un échec');
  assert.equal((await C.changerMotDePasse('MotDePasseSolide1', 'AutreMotDePasse2')).ok, true);
  assert.equal((await C.verifierMotDePasseCompte('AutreMotDePasse2')).ok, true);
  assert.equal((await C.verifierMotDePasseCompte('MotDePasseSolide1')).ok, false, 'l’ancien ne doit plus ouvrir');
});

test('la suppression retire le compte, pas les autres données', async () => {
  memoire.clear();
  await C.creerCompte('Utilisateur', 'MotDePasseSolide1');
  memoire.set('promos.favoris', '[]');
  C.supprimerCompte();
  assert.equal(C.compteEnregistre(), false);
  assert.equal(memoire.get('promos.favoris'), '[]', 'l’effacement des données de l’app est décidé ailleurs : ici, seul le compte part');
});

test('la fiche exportable ne contient aucun secret', async () => {
  memoire.clear();
  await C.creerCompte('Utilisateur', 'MotDePasseSolide1');
  const fiche = JSON.stringify(C.ficheCompte());
  assert.match(fiche, /Utilisateur/);
  assert.ok(!fiche.includes('empreinte') && !fiche.includes('sel'), 'la fiche montrée à l’utilisateur ne doit porter ni sel ni empreinte');
});

/* Récupère le corps d'une règle CSS par son sélecteur exact, en acceptant les
   sélecteurs en LISTE (« .verrou, .modale { »). Chercher « .classe { » tout
   court rate la règle et accuse du code juste — piège payé deux fois ici. */
function corpsDeRegle(css, classe, suffixe = '') {
  // Les commentaires sont retirés AVANT l'analyse : collés devant un sélecteur,
  // ils s'y accolaient (« /* ... */\n.verrou ») et la comparaison échouait —
  // le contrôle accusait alors du code parfaitement correct.
  const propre = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const cible = `.${classe}${suffixe}`;
  for (const m of propre.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].split(',').map((s) => s.trim()).includes(cible)) return m[2];
  }
  return null;
}

test('l’écran de verrouillage existe et couvre l’application', () => {
  // Le verrou a une raison d'être précisément parce qu'il bloque tout : s'il
  // laissait voir les favoris derrière, il ne protégerait rien.
  const css = fs.readFileSync(path.join(ICI, '..', 'public', 'app.css'), 'utf8');
  const html = fs.readFileSync(path.join(ICI, '..', 'public', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(ICI, '..', 'public', 'app.js'), 'utf8');
  const regle = corpsDeRegle(css, 'verrou');
  assert.ok(regle, 'le style du verrou doit exister');
  assert.match(regle, /position:\s*fixed/, 'le verrou doit couvrir l’écran, pas s’insérer dans la page');
  assert.match(regle, /inset:\s*0/, 'le verrou doit occuper tout l’écran');
  assert.match(html, /id="verrou"/, 'l’écran de verrouillage doit être dans la page');
  assert.match(app, /C\.compteEnregistre\(\)/, 'le démarrage doit consulter l’existence d’un compte');
  assert.match(app, /brancherVerrou\(\)/, 'le verrou doit être branché');
});

test('le pays est demandé à la première ouverture, et modifiable ensuite', () => {
  const css = fs.readFileSync(path.join(ICI, '..', 'public', 'app.css'), 'utf8');
  const html = fs.readFileSync(path.join(ICI, '..', 'public', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(ICI, '..', 'public', 'app.js'), 'utf8');
  assert.match(html, /id="paysDemande"/, 'la question d’ouverture doit exister dans la page');
  assert.match(app, /demanderPays\(\)/, 'elle doit être posée au démarrage');
  // Elle ne doit PAS être reposée à chaque lancement : un choix mémorisé coupe court.
  assert.match(app, /if \(enregistre\) return;/, 'un pays déjà choisi ne doit pas être redemandé');
  // Et le même choix doit être accessible dans les réglages.
  assert.match(html, /id="regPays"/, 'les réglages doivent porter la rubrique Pays');
  assert.match(app, /choisirPays\(/, 'un seul chemin doit appliquer le choix, où qu’il vienne');
  // Le panneau doit rendre la main à `hidden`, sinon il resterait posé sur l'écran.
  const regle = corpsDeRegle(css, 'modale', '[hidden]');
  assert.ok(regle, 'le panneau du pays doit avoir sa règle [hidden]');
  assert.match(regle, /display:\s*none/, 'le panneau du pays doit disparaître quand il est masqué');
});

test('aucun écran masquable ne reste posé sur l’application', () => {
  // Défaut trouvé au navigateur : la règle .verrou fixait « display: flex », ce
  // qui l'emporte sur le « display: none » de l'attribut `hidden`. L'écran de
  // verrouillage restait donc affiché en permanence et interceptait TOUS les
  // appuis : l'application ne répondait plus à rien, sans la moindre erreur.
  // Règle générale vérifiée ici : dès qu'un élément masquable a une règle CSS
  // qui impose un `display`, il lui faut aussi un `[hidden] { display: none }`.
  const css = fs.readFileSync(path.join(ICI, '..', 'public', 'app.css'), 'utf8');
  const html = fs.readFileSync(path.join(ICI, '..', 'public', 'index.html'), 'utf8');
  const fautifs = [];
  for (const balise of html.match(/<[^>]*\shidden[\s>][^>]*>/g) || []) {
    const classes = (((balise.match(/class="([^"]*)"/) || [])[1]) || '').split(/\s+/).filter(Boolean);
    for (const c of classes) {
      const base = corpsDeRegle(css, c);
      if (!base || !/display\s*:/.test(base)) continue;      // masquage natif : rien à faire
      const secours = corpsDeRegle(css, c, '[hidden]');
      if (!secours || !/display\s*:\s*none/.test(secours)) fautifs.push(c);
    }
  }
  assert.deepEqual(fautifs, [], `classes affichées malgré « hidden » : ${fautifs.join(', ')}`);
});

test('aucun formulaire de compte sans le module qui le fait fonctionner', () => {
  const app = fs.readFileSync(path.join(ICI, '..', 'public', 'app.js'), 'utf8');
  assert.match(app, /import \* as C from '\.\/compte\.js'/, 'app.js doit importer le module de compte');
  assert.match(app, /creerCompte/, 'le bouton de création doit appeler la création réelle');
  assert.match(app, /verifierMotDePasseCompte/, 'le déverrouillage doit vérifier réellement le mot de passe');
  assert.ok(!/confirm\(/.test(app), 'pas de fenêtre « confirm » : le WebView de l’APK peut la refuser en silence');
});
