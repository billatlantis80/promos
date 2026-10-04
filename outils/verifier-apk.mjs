#!/usr/bin/env node
/* ------------------------------------------------------------------------- *
 *  VÉRIFICATEUR D'IDENTITÉ DE L'APK ET DE L'AAB — application « Promos »
 *
 *  But : répondre par une PREUVE à « est-ce que l'application est à jour ? »,
 *  jamais de mémoire ni par « j'ai relancé le build ».
 *
 *  Pourquoi un script propre à ce projet : la fiche générique
 *  (`android-apk-from-webapp`) compare `public/` aux assets et signale deux
 *  écarts que CE projet crée VOLONTAIREMENT à chaque build :
 *
 *    • `index.html` est réécrit — le générateur d'instantané y insère la ligne
 *      `<script src="donnees.js">` AVANT le module, sans quoi le repli hors
 *      ligne serait vide ;
 *    • `donnees.js` est AJOUTÉ — c'est l'instantané, il n'existe pas dans le
 *      source web.
 *
 *  Les déclarer « divergences » ferait crier un contrôle pour rien, et un
 *  contrôle qui crie pour rien finit par ne plus être lu. On les prouve donc
 *  au lieu de les tolérer en bloc : `index.html` doit être identique AU CARACTÈRE
 *  PRÈS en dehors de la ligne insérée, et les fichiers en trop doivent être
 *  exactement l'instantané.
 *
 *  Piège de préfixe, à ne pas oublier : les assets vivent sous `assets/` dans
 *  l'APK et sous `base/assets/` dans l'AAB. Un contrôle écrit pour l'un et
 *  rejoué tel quel sur l'autre annonce un faux désastre — ou, pire, laisse
 *  passer un AAB périmé.
 *
 *  Usage : node outils/verifier-apk.mjs
 * ------------------------------------------------------------------------- */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');
const PUBLIC = path.join(RACINE, 'public');
const SORTIE = process.env.PROMOS_SORTIE || '/opt/data/android-build/sortie';

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/* Lecture de l'archive SANS `unzip` : le conteneur n'en a pas (la fiche de
 *  build le signale déjà, `unzip` est souvent absent). Node n'a pas de lecteur
 *  zip intégré, mais Python en a un — on lui demande le contenu en base64, ce
 *  qui évite d'ajouter une dépendance au projet pour un simple contrôle. */
const LECTEUR_ZIP = [
  'import json, base64, zipfile, sys',
  'z = zipfile.ZipFile(sys.argv[1])',
  'out = {n: base64.b64encode(z.read(n)).decode() for n in z.namelist() if not n.endswith("/")}',
  'sys.stdout.write(json.dumps(out))',
].join('\n');

const lireZip = (archive) => {
  const brut = execFileSync('python3', ['-c', LECTEUR_ZIP, archive],
    { maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' });
  const objet = JSON.parse(brut);
  const contenu = new Map();
  for (const [n, b64] of Object.entries(objet)) contenu.set(n, Buffer.from(b64, 'base64'));
  return contenu;
};

let ko = 0;
const dire = (ok, texte) => { console.log(`   ${ok ? '✓' : '✗'} ${texte}`); if (!ok) ko++; };

const source = new Map();
for (const f of fs.readdirSync(PUBLIC)) {
  const p = path.join(PUBLIC, f);
  if (fs.statSync(p).isFile()) source.set(f, fs.readFileSync(p));
}

console.log(`Source : ${source.size} fichiers dans public/`);

for (const [nom, archive, prefixe] of [
  ['APK', path.join(SORTIE, 'promos.apk'), 'assets/'],
  ['AAB', path.join(SORTIE, 'promos.aab'), 'base/assets/'],
]) {
  console.log(`\n=== ${nom} — ${path.basename(archive)}`);
  if (!fs.existsSync(archive)) { dire(false, `${nom} absent : ${archive}`); continue; }
  const zip = lireZip(archive);
  const dedans = new Map();
  for (const [n, buf] of zip) if (n.startsWith(prefixe) && !n.slice(prefixe.length).includes('/')) dedans.set(n.slice(prefixe.length), buf);

  // 1. Tout le source est là, à l'identique — index.html mis à part (réécrit).
  const absents = [], differents = [];
  for (const [f, buf] of source) {
    if (!dedans.has(f)) { absents.push(f); continue; }
    if (f === 'index.html') continue;                   // traité au point 2
    if (sha(buf) !== sha(dedans.get(f))) differents.push(f);
  }
  dire(absents.length === 0, `aucun fichier du source absent${absents.length ? ' — MANQUENT : ' + absents.join(', ') : ''}`);
  dire(differents.length === 0, `tous les fichiers identiques au source, octet par octet${differents.length ? ' — DIFFÉRENTS : ' + differents.join(', ') : ''}`);

  // 2. index.html : identique HORS la ligne insérée par le générateur.
  const srcHtml = source.get('index.html').toString('utf8');
  const apkHtml = (dedans.get('index.html') || Buffer.alloc(0)).toString('utf8');
  const lignesApk = apkHtml.split('\n');
  const inserees = lignesApk.filter((l) => l.includes('donnees.js'));
  dire(inserees.length === 1, `index.html contient exactement une ligne « donnees.js » (${inserees.length} trouvée(s))`);
  // On retire la ligne insérée : le reste doit être le source, caractère pour caractère.
  const sansInseree = lignesApk.filter((l) => !l.includes('donnees.js')).join('\n');
  dire(sansInseree === srcHtml, 'index.html identique au source hors la ligne d’instantané');
  // Et elle doit être AVANT le module : un module est différé, l'instantané
  // arriverait trop tard et le repli hors ligne serait vide.
  const posScript = apkHtml.indexOf('donnees.js');
  const posModule = apkHtml.indexOf('type="module"');
  dire(posScript > -1 && posModule > -1 && posScript < posModule, 'l’instantané est chargé AVANT le script module');

  // 3. Fichiers en trop : exactement l'instantané, rien d'autre.
  const enTrop = [...dedans.keys()].filter((f) => !source.has(f));
  dire(enTrop.length === 1 && enTrop[0] === 'donnees.js', `fichiers en trop : uniquement l’instantané${enTrop.length !== 1 || enTrop[0] !== 'donnees.js' ? ' — TROUVÉ : ' + enTrop.join(', ') : ''}`);

  // 4. L'instantané doit être FRAIS, pas l'égalité à la seconde : la collecte
  //    republie toutes les 5 minutes, une égalité stricte échouerait au hasard
  //    d'une republication sans qu'aucun défaut n'existe.
  try {
    // L'instantané est du JavaScript (`window.DONNEES = {…};`), pas du JSON
    // pur : on découpe du premier `{` au DERNIER `}`. Un simple retrait des
    // caractères de tête laissait le point-virgule final et faisait échouer la
    // lecture — un faux défaut de plus, qui accusait l'instantané alors qu'il
    // était parfaitement valide.
    const js = dedans.get('donnees.js').toString('utf8');
    const snap = JSON.parse(js.slice(js.indexOf('{'), js.lastIndexOf('}') + 1));
    const vivant = JSON.parse(fs.readFileSync(path.join(RACINE, 'docs', 'offres.json'), 'utf8'));
    const mn = Math.abs(new Date(vivant.genereLe) - new Date(snap.genereLe)) / 60000;
    const ecart = Math.abs((snap.offres || []).length - (vivant.offres || []).length);
    dire(mn <= 15, `instantané récent : ${mn.toFixed(0)} min d’écart (toléré 15, collecte toutes les 5 min)`);
    dire(ecart <= Math.max(10, Math.floor((vivant.offres || []).length / 20)),
      `${(snap.offres || []).length} offres embarquées / ${(vivant.offres || []).length} publiées (écart ${ecart})`);
    const sansPays = (snap.offres || []).filter((o) => !o.pays).length;
    dire(sansPays === 0, `aucune offre sans pays dans l’instantané (${sansPays} trouvée(s))`);
  } catch (e) {
    dire(false, `instantané illisible : ${e.message}`);
  }

  // 5. Signature : identique d'un build à l'autre ⇒ installation par-dessus
  //    possible, données de l'utilisateur conservées.
  const env = { ...process.env, JAVA_HOME: '/opt/data/android-build/jdk-17.0.20.1+1' };
  env.PATH = `${env.JAVA_HOME}/bin:${env.PATH}`;
  if (nom === 'AAB') {
    // Un AAB n'est PAS un APK : `apksigner` le refuse (« Missing
    // AndroidManifest.xml ») et crierait à tort. Il se vérifie avec jarsigner.
    try {
      const r = execFileSync('jarsigner', ['-verify', archive], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
      dire(/jar verified/.test(r), 'AAB signé (vérifié par jarsigner)');
    } catch (e) {
      dire(false, `AAB non vérifiable : ${String(e.message).slice(0, 60)}`);
    }
  } else {
    try {
      const certs = execFileSync('/opt/data/android-build/sdk/build-tools/34.0.0/apksigner',
        ['verify', '--print-certs', archive], { encoding: 'utf8', env });
      const empreinte = (certs.match(/SHA-256 digest: ([0-9a-f]+)/) || [])[1] || '?';
      dire(empreinte.startsWith('f15debc'), `signature ${empreinte.slice(0, 16)}… (attendu f15debc…, clé conservée)`);
    } catch (e) {
      dire(false, `signature non vérifiable : ${String(e.message).slice(0, 60)}`);
    }
  }
}

console.log(`\n${ko ? `✗ ${ko} contrôle(s) en échec — NE PAS ANNONCER « À JOUR »` : '✓ APK et AAB conformes au source web, instantané frais, signature conservée'}`);
process.exit(ko ? 1 : 0);
