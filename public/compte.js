/**
 * APPLICATION N°2 — compte local.
 *
 * CE QU'IL EST, ET CE QU'IL N'EST PAS.
 * Il n'y a pas de serveur : ce compte vit sur l'appareil et nulle part ailleurs.
 * Il fait donc deux choses, réellement :
 *   1. protéger l'accès à l'application (favoris, réglages) sur CET appareil ;
 *   2. donner un nom au porteur des données, pour l'export et l'effacement.
 * Il ne synchronise RIEN d'un téléphone à l'autre, et il ne permet à personne de
 * retrouver un mot de passe oublié. C'est écrit à l'utilisateur au moment de
 * l'inscription, en clair — pas caché dans une note de bas de page. Un bouton
 * « Se connecter » qui ne connecte personne serait un mensonge ; ceci, non.
 *
 * LE MOT DE PASSE N'EST JAMAIS CONSERVÉ. On garde un sel aléatoire et une
 * empreinte PBKDF2-SHA256 (200 000 tours). Vérifier, c'est recalculer et
 * comparer — jamais relire.
 */

const CLE = 'promos.compte';
const TOURS = 200000;
const TAILLE_SEL = 16;
const TAILLE_CLE = 32;
const NOM_MIN = 3;
const NOM_MAX = 24;
const MDP_MIN = 8;

const versB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const deB64 = (txt) => Uint8Array.from(atob(txt), (c) => c.charCodeAt(0));

function lire() {
  try {
    const c = JSON.parse(localStorage.getItem(CLE) || 'null');
    return c && c.nom && c.sel && c.empreinte ? c : null;
  } catch { return null; }
}

/** Un compte existe-t-il sur cet appareil ? */
export const compteEnregistre = () => !!lire();

/** Nom porté par le compte, ou chaîne vide. */
export const nomCompte = () => (lire() || {}).nom || '';

/** Fiche du compte SANS le secret : ce qu'on peut montrer ou exporter. */
export function ficheCompte() {
  const c = lire();
  return c ? { nom: c.nom, cree: c.cree, tours: c.tours, algorithme: c.algo } : null;
}

/** Règles de l'identifiant de compte.
 *
 *  ⚠ DÉFAUT CORRIGÉ (08/10/2026), trouvé en EXERÇANT le formulaire et non en
 *  relisant le code. Depuis que l'inscription collecte des adresses e-mail, le
 *  formulaire envoie une adresse… et la règle ci-dessous la REFUSAIT : elle
 *  n'admettait que lettres, chiffres, point, tiret et souligné — donc jamais le
 *  caractère « @ ». Résultat : « marie@exemple.be » renvoyait « Lettres,
 *  chiffres, point, tiret et souligné uniquement. » et le compte n'était JAMAIS
 *  créé, donc l'adresse n'était jamais envoyée au tableau. Les deux règles
 *  vivaient dans deux fichiers, chacune correcte toute seule.
 *
 *  On garde donc DEUX règles, choisies par la présence du « @ » : une adresse est
 *  jugée comme une adresse, un nom comme un nom. Les comptes déjà créés avec un
 *  nom continuent de fonctionner à l'identique.
 *
 *  Volontairement, aucun message nouveau n'est introduit : une adresse vide ou
 *  trop longue reçoit le même refus qu'une adresse mal formée. Trois façons de
 *  dire la même chose à l'utilisateur n'apportent rien.
 */
export function verifierNom(nom) {
  const n = String(nom || '').trim();
  if (n.includes('@')) {
    // Adresse e-mail : un seul @, quelque chose avant, un point après.
    if (n.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(n)) {
      return { ok: false, message: "Cette adresse e-mail n'est pas valide." };
    }
    // Rangée en minuscules : « Marie@… » et « marie@… » sont la MÊME personne.
    // Sans cela, deux inscriptions pour une seule adresse, donc deux newsletters.
    return { ok: true, valeur: n.toLowerCase() };
  }
  if (n.length < NOM_MIN) return { ok: false, message: `Le nom doit faire au moins ${NOM_MIN} caractères.` };
  if (n.length > NOM_MAX) return { ok: false, message: `Le nom ne doit pas dépasser ${NOM_MAX} caractères.` };
  if (!/^[\p{L}\p{N}._-]+$/u.test(n)) return { ok: false, message: 'Lettres, chiffres, point, tiret et souligné uniquement.' };
  return { ok: true, valeur: n };
}

export function verifierMotDePasse(mdp) {
  const m = String(mdp || '');
  if (m.length < MDP_MIN) return { ok: false, message: `Le mot de passe doit faire au moins ${MDP_MIN} caractères.` };
  if (/^[0-9]+$/.test(m)) return { ok: false, message: 'Un mot de passe fait seulement de chiffres se devine en quelques secondes.' };
  return { ok: true };
}

async function empreinte(motDePasse, sel, tours) {
  const cle = await crypto.subtle.importKey('raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: sel, iterations: tours, hash: 'SHA-256' }, cle, TAILLE_CLE * 8);
}

/** Crée le compte. Écrase un éventuel compte existant (l'appelant prévient). */
export async function creerCompte(nom, motDePasse) {
  const vn = verifierNom(nom);
  if (!vn.ok) return vn;
  const vm = verifierMotDePasse(motDePasse);
  if (!vm.ok) return vm;
  const sel = crypto.getRandomValues(new Uint8Array(TAILLE_SEL));
  const emp = await empreinte(motDePasse, sel, TOURS);
  const compte = {
    nom: vn.valeur,
    sel: versB64(sel),
    empreinte: versB64(emp),
    tours: TOURS,
    algo: 'PBKDF2-SHA256',
    cree: new Date().toISOString(),
  };
  try { localStorage.setItem(CLE, JSON.stringify(compte)); } catch { /* mode privé */ }
  return { ok: true, nom: vn.valeur };
}

/** Vrai si le mot de passe correspond au compte de cet appareil. */
export async function verifierMotDePasseCompte(motDePasse) {
  const c = lire();
  if (!c) return { ok: false, message: 'Aucun compte sur cet appareil.' };
  const emp = await empreinte(String(motDePasse || ''), deB64(c.sel), c.tours || TOURS);
  const attendu = deB64(c.empreinte);
  const obtenu = new Uint8Array(emp);
  // Comparaison à durée constante : on ne sort pas au premier octet différent.
  let diff = obtenu.length === attendu.length ? 0 : 1;
  for (let i = 0; i < Math.max(obtenu.length, attendu.length); i++) diff |= (obtenu[i] || 0) ^ (attendu[i] || 0);
  return diff === 0 ? { ok: true, nom: c.nom } : { ok: false, message: 'Mot de passe incorrect.' };
}

/** Change le mot de passe : l'ancien est exigé, le nouveau repart d'un sel neuf. */
export async function changerMotDePasse(ancien, nouveau) {
  const v = await verifierMotDePasseCompte(ancien);
  if (!v.ok) return { ok: false, message: 'Ancien mot de passe incorrect.' };
  const vm = verifierMotDePasse(nouveau);
  if (!vm.ok) return vm;
  return creerCompte(nomCompte(), nouveau);
}

/** Efface le compte. Les données de l'application sont effacées À PART (voir app.js). */
export function supprimerCompte() {
  try { localStorage.removeItem(CLE); } catch { /* rien */ }
}
