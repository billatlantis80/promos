/**
 * JOURNAL DE TRAFIC — application n°2 « Kazendra ».
 *
 * CE QU'IL EST : un relevé écrit SUR L'APPAREIL, sans traceur tiers, sans
 * cookie publicitaire, sans requête vers un inconnu. Il note une visite par
 * ouverture : le pays consulté, la langue de l'interface, par où l'utilisateur
 * est entré, si c'est l'application Android ou le navigateur, et quand.
 *
 * CE QU'IL N'EST PAS : un compteur global. Sans serveur, chaque appareil tient
 * son propre journal ; personne ne les additionne. Le panneau d'administration
 * le DIT au lieu de laisser croire à des chiffres complets. Le jour où le
 * relais est branché, c'est ce même relevé qui part — la forme est déjà la
 * bonne, il n'y a qu'une adresse à renseigner.
 *
 * RÈGLE DE DISCRÉTION : on ne garde AUCUNE adresse IP, aucun identifiant
 * d'appareil, aucune donnée personnelle. Un pays, une langue, une porte, une
 * heure. Rien qui permette de reconnaître quelqu'un.
 */

const CLE_TRAFIC = 'kazendra.trafic';
const MAX = 2000;                  // borne : on ne remplit pas le téléphone
const CLE_SESSION = 'kazendra.session';

const lire = () => {
  try { return JSON.parse(localStorage.getItem(CLE_TRAFIC) || '[]'); } catch { return []; }
};

/** L'application tourne-t-elle dans la coque Android, ou dans un navigateur ?
 *  On regarde le pont natif que la coque installe (voir MainActivity.java) —
 *  c'est une preuve, pas une supposition sur la chaîne « user-agent ». */
const estApplication = () =>
  typeof window.AndroidPartage !== 'undefined' || /KazendraApp/i.test(navigator.userAgent);

/** D'où vient cette visite : d'où l'utilisateur est arrivé, ou à défaut par
 *  quelle porte il est entré dans l'application. */
function entree() {
  try {
    const ref = document.referrer || '';
    if (!ref) return 'direct';
    const h = new URL(ref).hostname.replace(/^www\./, '');
    if (h.includes('google')) return 'recherche Google';
    if (h.includes('facebook')) return 'Facebook';
    if (h.includes('instagram')) return 'Instagram';
    return h;
  } catch { return 'direct'; }
}

/** Note l'ouverture. Un seul relevé par session : rafraîchir la page dix fois
 *  n'est pas dix visites, et gonfler le compteur ne servirait personne. */
export function noterVisite({ pays, langue, relais } = {}) {
  let session = null;
  try { session = sessionStorage.getItem(CLE_SESSION); } catch { /* mode privé */ }
  if (session) return false;
  const releve = {
    quand: new Date().toISOString(),
    pays: pays || '?',
    langue: langue || '?',
    entree: entree(),
    appareil: estApplication() ? 'application' : 'navigateur',
    vues: 1,
  };
  try {
    const t = lire();
    t.push(releve);
    // Borne atteinte : on jette les plus anciens, on garde les récents.
    localStorage.setItem(CLE_TRAFIC, JSON.stringify(t.length > MAX ? t.slice(-MAX) : t));
    sessionStorage.setItem(CLE_SESSION, '1');
  } catch { /* stockage plein ou navigation privée : on n'insiste pas */ }
  // Relais : s'il est renseigné, on prévient le serveur du propriétaire. En
  // « no-cors » et sans attendre la réponse — le trafic ne doit jamais retarder
  // l'affichage. Si l'envoi échoue, le relevé local reste : rien n'est perdu.
  if (relais) {
    try {
      fetch(relais, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ type: 'visite', ...releve }),
      }).catch(() => { /* relais muet */ });
    } catch { /* rien */ }
  }
  return true;
}

/** Une page vue de plus dans la session en cours (changement de rubrique). */
export function noterVue() {
  try {
    const t = lire();
    if (!t.length) return;
    t[t.length - 1].vues = (t[t.length - 1].vues || 1) + 1;
    localStorage.setItem(CLE_TRAFIC, JSON.stringify(t));
  } catch { /* rien */ }
}
