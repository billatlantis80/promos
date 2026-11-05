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

/** LE FUSEAU DU VISITEUR — « d'où il vient », sans jamais demander son adresse.
 *
 *  Défaut comblé le 12/10/2026 (demande de B : « voir d'où viennent les
 *  utilisateurs »). Jusqu'ici le relevé ne portait que le pays CONSULTÉ : on
 *  savait quel catalogue intéressait la visite, jamais de quelle région du
 *  monde elle venait. Or le navigateur connaît son fuseau horaire
 *  (« Europe/Brussels ») — une information GROSSIÈRE, qui ne désigne personne,
 *  qui ne se conserve nulle part ailleurs, et qu'aucun tiers n'a besoin de
 *  fournir. C'est l'alternative honnête à l'adresse IP : elle dit la région,
 *  pas la personne.
 *
 *  ⚠ ON NE RECULE PAS SUR LA RÈGLE DE DISCRÉTION : aucune IP, aucun identifiant
 *  d'appareil, aucun témoin publicitaire. Un fuseau, une langue, une porte, une
 *  heure — et le tout reste chez le propriétaire. */
function fuseau() {
  try { return String(Intl.DateTimeFormat().resolvedOptions().timeZone || '').slice(0, 40) || '?'; }
  catch { return '?'; }
}

/** LA PORTE D'ENTRÉE — le chemin par lequel la visite est arrivée.
 *  « / » pour l'accueil, « /rubriques/bricolage » pour une page de rubrique,
 *  « /o/abc123.html » pour une page de partage. Sans les paramètres : ils
 *  portent le pays consulté, déjà relevé à part, et les recopier ici ferait
 *  deux compteurs pour la même chose. */
function porte() {
  try { return String(location.pathname || '/').slice(0, 80); } catch { return '?'; }
}

/** D'où vient cette visite : d'où l'utilisateur est arrivé, ou à défaut par
 *  quelle porte il est entré dans l'application.
 *
 *  « Partage Kazendra » EST UNE CATÉGORIE, PAS UN DOMAINE PARMI D'AUTRES
 *  (ajouté le 12/10/2026). Quelqu'un qui ouvre une page de partage envoyée sur
 *  Facebook ou par message arrive ensuite ici : son référent est notre propre
 *  domaine. Sans cette ligne, ces visites se lisaient « kazendra.com » — un nom
 *  de domaine dans une colonne de provenance, qui n'apprend rien et masque la
 *  seule chose à savoir : elles viennent d'un PARTAGE, pas d'une recherche. */
function entree() {
  try {
    const ref = document.referrer || '';
    if (!ref) return 'direct';
    const h = new URL(ref).hostname.replace(/^www\./, '');
    // Notre propre domaine : la visite arrive d'une page kazendra (partage,
    // page de rubrique, lien interne). On le dit, au lieu de le nommer.
    try {
      if (h === location.hostname.replace(/^www\./, '')) return 'partage Kazendra';
    } catch { /* localisation illisible : on continue */ }
    if (h.includes('google')) return 'recherche Google';
    if (h.includes('bing')) return 'recherche Bing';
    if (h.includes('facebook') || h.includes('fb.')) return 'Facebook';
    if (h.includes('instagram')) return 'Instagram';
    if (h.includes('whatsapp') || h.includes('wa.me')) return 'WhatsApp';
    if (h.includes('pinterest')) return 'Pinterest';
    if (h.includes('t.co') || h.includes('twitter') || h.includes('x.com')) return 'X (Twitter)';
    return h;
  } catch { return 'direct'; }
}

/* --------------------------------------------------------------------------
 * LE TUYAU D'ENVOI — un seul, pour les visites COMME pour les clics.
 *
 * Écrit une fois et appelé partout : deux tuyaux qui construiraient chacun leur
 * requête finiraient par ne plus envoyer la même chose, et le jour où l'un
 * casserait, l'autre continuerait — donc « ça marche encore » serait vrai pour
 * la moitié du panneau.
 *
 * POURQUOI UN FORMULAIRE (`URLSearchParams`) ET NON DU JSON. Le relais est un
 * service Apps Script : il lit les champs dans `e.parameter`. Un corps JSON
 * arriverait dans `e.postData.contents`, donc par un SECOND chemin de lecture
 * côté récepteur — deux façons d'analyser, deux occasions de se tromper. Le
 * formulaire rend le récepteur bête et sûr : tous les champs, toujours au même
 * endroit. C'est aussi une requête « simple » au sens du navigateur : aucun
 * contrôle préalable (preflight) n'est déclenché, donc rien n'est refusé en
 * silence. Même forme que l'inscription : un seul tuyau pour tout le site.
 *
 * CE QU'ON NE PEUT PAS SAVOIR : si le relais a bien reçu. La page envoie en
 * « no-cors » et ne lit pas la réponse (le tableau répond sans l'autoriser).
 * Un échec d'envoi est donc INVISIBLE d'ici — c'est pourquoi le relevé reste
 * écrit sur l'appareil, et pourquoi le panneau dit toujours sur quoi il compte.
 * -------------------------------------------------------------------------- */
function poster(champs, adresse) {
  const a = String(adresse || '').trim();
  if (!a) return false;
  try {
    const corps = new URLSearchParams();
    for (const [k, v] of Object.entries(champs)) {
      if (v === undefined || v === null || v === '') continue;
      corps.set(k, String(v).slice(0, 120));
    }
    fetch(a, { method: 'POST', mode: 'no-cors', body: corps })
      .catch(() => { /* relais muet : le relevé local reste */ });
    return true;
  } catch { return false; }
}

/** Note l'ouverture. Un seul relevé par session : rafraîchir la page dix fois
 *  n'est pas dix visites, et gonfler le compteur ne servirait personne. */
export function noterVisite({ pays, langue, relais, page } = {}) {
  let session = null;
  try { session = sessionStorage.getItem(CLE_SESSION); } catch { /* mode privé */ }
  if (session) return false;
  const releve = {
    quand: new Date().toISOString(),
    pays: pays || '?',
    langue: langue || '?',
    entree: entree(),
    appareil: estApplication() ? 'application' : 'navigateur',
    fuseau: fuseau(),
    page: page || porte(),
    vues: 1,
  };
  try {
    const t = lire();
    t.push(releve);
    // Borne atteinte : on jette les plus anciens, on garde les récents.
    localStorage.setItem(CLE_TRAFIC, JSON.stringify(t.length > MAX ? t.slice(-MAX) : t));
    sessionStorage.setItem(CLE_SESSION, '1');
  } catch { /* stockage plein ou navigation privée : on n'insiste pas */ }
  // Le relevé part au relais quand il est branché. La forme envoyée est celle
  // du relevé lui-même : ce qui part est ce qui est écrit, jamais une seconde
  // version qui pourrait diverger.
  poster({ type: 'visite', ...releve }, relais);
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

/* --------------------------------------------------------------------------
 * LES ACTIONS — un clic vers un marchand, un partage.
 *
 * DEMANDE DE B (08/10/2026) : « la quantité d'articles partagés, et autres
 * statistiques qui permettent de surveiller le trafic en temps réel ».
 *
 * POURQUOI UN SECOND JOURNAL, ET PAS LE PREMIER. Celui des visites est borné à
 * 2000 relevés et ne compte qu'une ouverture par session. Y verser les clics
 * aurait fait disparaître les visites les plus anciennes au bout de quelques
 * jours de trafic : on aurait perdu la mesure lente (d'où viennent les gens)
 * pour la mesure rapide (ce qu'ils font). Deux journaux, deux durées.
 *
 * CE QU'ON N'ENREGISTRE PAS, comme pour les visites : aucune adresse IP, aucun
 * identifiant d'appareil, aucune donnée personnelle. Le MARCHAND visé, la
 * source, le pays consulté, l'heure. Rien qui permette de reconnaître quelqu'un
 * — et surtout pas le contenu de ce qu'il a cherché ailleurs.
 *
 * LA VALEUR DE CETTE MESURE. Elle dit quels acteurs intéressent réellement les
 * visiteurs, et lesquels ont des annonces que personne ne regarde. Sans elle,
 * on juge un acteur au nombre d'articles qu'il apporte — ce qui ne dit rien de
 * l'intérêt qu'on leur porte.
 * -------------------------------------------------------------------------- */

const CLE_ACTIONS = 'kazendra.actions';
const MAX_ACTIONS = 5000;          // borne plus large : un clic est plus rare qu'une visite

/** Le journal des actions de CET appareil. */
export function lireActions() {
  try { return JSON.parse(localStorage.getItem(CLE_ACTIONS) || '[]'); } catch { return []; }
}

/** L'HÔTE DE DESTINATION — vers quel marchand la redirection emmène vraiment.
 *
 *  Ajouté le 12/10/2026 (demande de B : « au niveau des affiliations, il faut
 *  que je voie combien j'ai pu gagner grâce aux redirections »). Le nom du
 *  marchand (« Amazon ») ne dit PAS quel programme est concerné : Amazon
 *  délivre un identifiant par pays, et une commission française n'existe pas sur
 *  un lien belge. Seul l'HÔTE de l'adresse réellement ouverte le dit
 *  (« amazon.fr » ou « amazon.com.be ») — c'est donc lui, et lui seul, qui
 *  permet de rattacher un clic au bon programme. Un nom deviné ne le
 *  permettrait pas. */
function hoteDe(url) {
  try { return String(new URL(url).hostname || '').toLowerCase().replace(/^www\./, '').slice(0, 60); }
  catch { return ''; }
}

/** Note un clic sortant (« clic ») ou un partage (« partage »).
 *
 *  RETOUR — le relevé écrit, ou null si rien n'a pu être écrit (navigation
 *  privée, stockage plein). C'est ce relevé-là, exactement, que l'appelant
 *  envoie au relais : une seule construction, donc aucune chance que la copie
 *  locale et la copie distante racontent deux choses différentes. */
export function noterAction({ type, marchand, source, pays, canal, url } = {}) {
  if (type !== 'clic' && type !== 'partage') return null;
  const releve = {
    quand: new Date().toISOString(),
    type,
    marchand: String(marchand || '?').slice(0, 60),
    source: String(source || '?').slice(0, 60),
    pays: String(pays || '?').slice(0, 8),
  };
  const h = hoteDe(url);
  if (h) releve.hote = h;
  if (canal) releve.canal = String(canal).slice(0, 20);
  try {
    const t = lireActions();
    t.push(releve);
    localStorage.setItem(CLE_ACTIONS, JSON.stringify(t.length > MAX_ACTIONS ? t.slice(-MAX_ACTIONS) : t));
  } catch { return releve; }   // non écrit localement, mais la mesure reste valable
  return releve;
}

/** Le même relevé part au relais quand il est branché — par LE MÊME tuyau que
 *  les visites (voir `poster`), donc même forme, même lecture côté récepteur.
 *  C'est ce qui manquait : les clics étaient mesurés sur l'appareil et
 *  n'allaient nulle part, si bien que « combien j'ai gagné » n'avait aucune
 *  source. */
export function relayerAction(releve, relais) {
  if (!releve) return false;
  return poster({ ...releve }, relais);
}
