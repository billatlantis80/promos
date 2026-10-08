/**
 * LE DÉPÔT SE RÉPARE TOUT SEUL — application n°2 « Kazendra ».
 *
 * CE QUI S'EST VRAIMENT PASSÉ, ET POURQUOI CE TEST EXISTE.
 * Le 08/10/2026, une coupure de courant est tombée pendant que git écrivait un
 * commit. Git a été interrompu en pleine écriture et a laissé un objet de
 * **0 octet** à la place du commit. Résultat exact : « fatal: bad object HEAD »,
 * toute commande git impossible, plus rien de publiable vers GitHub — et en
 * silence. La collecte continuait, le site restait en ligne, la sauvegarde était
 * morte sans que personne ne le sache. Il a fallu une réparation à la main.
 *
 * CE TEST REPRODUIT LA PANNE POUR DE VRAI. Il ne relit pas le script : il
 * construit un dépôt jetable avec une origine, TRONQUE l'objet du commit à
 * 0 octet — la panne exacte — puis exécute `reparer_depot()`, EXTRAITE du vrai
 * `bin/collecter.sh`. Un contrôle qui se contenterait de chercher le mot
 * « reparer » dans le fichier ne prouverait rien du tout.
 *
 * Piège évité : un clone local de git partage les objets par LIEN MATÉRIEL. Un
 * `truncate` sur la copie aurait tronqué l'ORIGINE en même temps (même inode) :
 * le test aurait été un mensonge. D'où `--no-hardlinks`.
 *
 * Lancement : node --test tests/depot-auto-reparation.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const CHEMIN_SCRIPT = path.join(ICI, '..', 'bin', 'collecter.sh');
const script = fs.readFileSync(CHEMIN_SCRIPT, 'utf8');

/** La fonction telle qu'elle est LIVRÉE, pas une copie qui pourrait diverger. */
function extraireFonction() {
  const m = script.match(
    /# --- DEBUT fonction de reparation du depot[\s\S]*?# --- FIN fonction de reparation du depot ---/);
  assert.ok(m, 'la fonction de réparation doit exister dans bin/collecter.sh (marqueurs DEBUT/FIN)');
  return m[0];
}

/* ---------------------------------------------------------------- outils git */

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function gitEchoue(args, cwd) {
  try { git(args, cwd); return null; } catch (e) { return String(e.stderr || e.message); }
}

/** Un dépôt neuf, avec une origine à lui, un commit déjà poussé. */
function depotNeuf() {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'depot-'));
  const origine = path.join(racine, 'origine.git');
  const travail = path.join(racine, 'travail');
  git(['init', '-q', '--bare', '-b', 'main', origine]);
  // --no-hardlinks : sinon tronquer la copie tronquerait l'origine (même inode).
  git(['clone', '-q', '--no-hardlinks', origine, travail]);
  git(['-C', travail, 'config', 'user.email', 'test@local']);
  git(['-C', travail, 'config', 'user.name', 'Test']);
  fs.writeFileSync(path.join(travail, 'docs.txt'), 'le site publié\n');
  git(['-C', travail, 'add', '-A']);
  git(['-C', travail, 'commit', '-q', '-m', 'premier']);
  git(['-C', travail, 'push', '-q', 'origin', 'main']);
  return { racine, origine, travail };
}

/** La panne exacte : l'objet du commit courant est mis à 0 octet. */
function tronquerLeCommit(travail) {
  const sha = git(['-C', travail, 'rev-parse', 'HEAD']).trim();
  const objet = path.join(travail, '.git', 'objects', sha.slice(0, 2), sha.slice(2));
  assert.ok(fs.existsSync(objet),
    'l’objet du commit doit être un fichier séparé (pas empaqueté) pour que le test reproduise la panne');
  // Git écrit ses objets en LECTURE SEULE (0444) : c'est une fois écrits qu'ils
  // ne bougent plus. La panne réelle laisse derrière elle un objet de 0 octet,
  // permissions comprises — on rend donc le fichier inscriptible le temps de
  // reproduire l'ÉTAT (0 octet), qui est tout ce qui compte ici.
  fs.chmodSync(objet, 0o644);
  fs.truncateSync(objet, 0);
  assert.equal(fs.statSync(objet).size, 0);
  return objet;
}

/** Exécute la fonction extraite, comme le fait le vrai script. */
function reparer(travail) {
  const harnais = [
    'GIT="git -c core.editor=true"',
    'alerte() { printf "ALERTE:%s\\n" "$1"; }',
    extraireFonction(),
    'reparer_depot',
    'echo "CODE=$?"',
  ].join('\n');
  const fichier = path.join(travail, '..', 'harnais.sh');
  fs.writeFileSync(fichier, harnais);
  let sortie = '';
  try {
    sortie = execFileSync('bash', [fichier], { cwd: travail, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    sortie = String(e.stdout || '') + String(e.stderr || '');
  }
  return sortie;
}

/* --------------------------------------------------------------------- tests */

test('LA PANNE EST BIEN REPRODUITE : un commit tronqué rend le dépôt illisible', () => {
  const d = depotNeuf();
  tronquerLeCommit(d.travail);
  // C'est le symptôme exact du 08/10/2026.
  const erreur = gitEchoue(['-C', d.travail, 'log', '-1', '--oneline'], d.travail);
  assert.ok(erreur, 'un dépôt au commit tronqué DOIT refuser de répondre');
  assert.match(erreur, /bad object HEAD|empty|fatal/i,
    `le symptôme attendu est « bad object HEAD », obtenu : ${erreur}`);
  fs.rmSync(d.racine, { recursive: true, force: true });
});

test('LE DÉPÔT SE RÉPARE TOUT SEUL, et le dit', () => {
  const d = depotNeuf();
  tronquerLeCommit(d.travail);
  const sortie = reparer(d.travail);

  assert.match(sortie, /CODE=0/, `la réparation doit réussir, sortie : ${sortie}`);
  assert.match(sortie, /ALERTE:.*réparé tout seul/,
    'la réparation doit être ANNONCÉE : une panne réparée en silence laisse croire que rien n’a bougé');
  assert.match(sortie, /1 objet\(s\) tronqué\(s\)/,
    'le message doit dire COMBIEN d’objets ont été perdus');

  // Le dépôt répond de nouveau — c'est la seule preuve qui compte.
  assert.doesNotThrow(() => git(['-C', d.travail, 'log', '-1', '--oneline'], d.travail));
  assert.doesNotThrow(() => git(['-C', d.travail, 'cat-file', '-e', 'HEAD'], d.travail));
  assert.doesNotThrow(() => git(['-C', d.travail, 'cat-file', '-e', 'HEAD^{tree}'], d.travail));

  // Et le contenu de travail n'a pas été touché.
  assert.equal(fs.readFileSync(path.join(d.travail, 'docs.txt'), 'utf8'), 'le site publié\n');

  // L'origine, elle, n'a jamais été abîmée (preuve que --no-hardlinks protège).
  assert.doesNotThrow(() => git(['-C', d.origine, 'cat-file', '-e', 'HEAD'], d.origine));
  fs.rmSync(d.racine, { recursive: true, force: true });
});

test('APRÈS RÉPARATION, ON PEUT DE NOUVEAU PUBLIER (le vrai enjeu)', () => {
  const d = depotNeuf();
  tronquerLeCommit(d.travail);
  reparer(d.travail);
  // Ce que le script fait juste après : reposer un commit sur la pointe et pousser.
  fs.writeFileSync(path.join(d.travail, 'docs.txt'), 'le site publié, mis à jour\n');
  git(['-C', d.travail, 'add', '-A', 'docs.txt']);
  git(['-C', d.travail, 'commit', '-q', '-m', 'Collecte de contrôle']);
  assert.doesNotThrow(() => git(['-C', d.travail, 'push', '-q', 'origin', 'main']),
    'un dépôt réparé doit pouvoir pousser — sinon la réparation ne sert à rien');
  fs.rmSync(d.racine, { recursive: true, force: true });
});

test('un dépôt SAIN n’est pas touché, et on ne dit rien', () => {
  const d = depotNeuf();
  const avant = git(['-C', d.travail, 'rev-parse', 'HEAD']).trim();
  const sortie = reparer(d.travail);
  assert.match(sortie, /CODE=0/);
  assert.ok(!/ALERTE:/.test(sortie), 'un dépôt sain ne doit produire AUCUNE alerte (sinon on crie au loup)');
  assert.equal(git(['-C', d.travail, 'rev-parse', 'HEAD']).trim(), avant,
    'la réparation ne doit pas déplacer HEAD sur un dépôt sain');
  fs.rmSync(d.racine, { recursive: true, force: true });
});

test('un dépôt qui n’a JAMAIS eu de commit est laissé tranquille', () => {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'depot-vide-'));
  const travail = path.join(racine, 'travail');
  git(['init', '-q', '-b', 'main', travail]);
  const sortie = reparer(travail);
  assert.match(sortie, /CODE=0/);
  assert.ok(!/ALERTE:/.test(sortie), 'un dépôt neuf n’est pas une panne : rien à annoncer');
  fs.rmSync(racine, { recursive: true, force: true });
});

test('si GitHub est injoignable, on le DIT au lieu de réparer en silence', () => {
  const d = depotNeuf();
  tronquerLeCommit(d.travail);
  git(['-C', d.travail, 'remote', 'set-url', 'origin', path.join(d.racine, 'origine-inexistante.git')]);
  const sortie = reparer(d.travail);
  assert.match(sortie, /CODE=1/, 'une réparation impossible doit se signaler par un code d’erreur');
  assert.match(sortie, /ALERTE:.*injoignable/);
  fs.rmSync(d.racine, { recursive: true, force: true });
});

/* --- Les garde-fous : la réparation reste BRANCHÉE sur le vrai script ------- */

test('le script RÉPARE AVANT de collecter, et s’arrête si la réparation échoue', () => {
  const iRepare = script.indexOf('if ! reparer_depot; then');
  const iCollecte = script.indexOf('node collecteur.mjs');
  assert.ok(iRepare > 0, 'le script doit appeler la réparation');
  assert.ok(iCollecte > 0);
  assert.ok(iRepare < iCollecte,
    'la réparation doit passer AVANT la collecte : après, le commit et l’envoi ont déjà échoué');
  assert.match(script, /if ! reparer_depot; then\s*\n\s*exit 1/,
    'une réparation ratée doit ARRÊTER le passage, sinon la panne reste silencieuse');
});

test('la réparation vérifie le commit ET son arborescence', () => {
  // S’arrêter au commit laisserait passer un dépôt dont l’arborescence est
  // cassée : git répondrait, puis échouerait à l’étape suivante.
  const f = extraireFonction();
  assert.match(f, /cat-file -e HEAD(?!\^)/);
  assert.match(f, /cat-file -e 'HEAD\^\{tree\}'/);
});

test('les objets de 0 octet sont effacés AVANT la récupération', () => {
  // Sinon git croit les avoir et ne les retélécharge pas : la réparation
  // « réussirait » sur un dépôt toujours cassé.
  const f = extraireFonction();
  const iEfface = f.indexOf("-size 0 -delete");
  const iRecupere = f.indexOf('fetch');
  assert.ok(iEfface > 0 && iRecupere > iEfface,
    'l’effacement doit précéder la récupération, dans cet ordre');
});
