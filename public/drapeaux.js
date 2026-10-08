/**
 * LES DRAPEAUX, DESSINÉS EN VECTORIEL — module partagé.
 *
 * POURQUOI PAS LES EMOJI (🇫🇷) : Windows ne les dessine pas — il affiche les
 * deux lettres « FR » dans un petit carré. Sur une application qui vise toute
 * l'Europe, un drapeau qui devient du texte selon la machine n'est pas
 * acceptable. Ces tracés-là s'affichent identiquement partout, à toute taille,
 * et ne coûtent AUCUNE requête réseau (un fichier image par drapeau = neuf
 * téléchargements de plus sur un forfait mobile — contraire à la règle
 * d'économie de données).
 *
 * POURQUOI CE FICHIER EXISTE (08/10/2026). B a demandé, pour le panneau
 * d'administration, « un tableau comme il y a dans les paramètres de l'appli,
 * avec les drapeaux ». Le panneau est une application À PART : il n'emprunte
 * rien à la vitrine, et c'est délibéré (une modification du site ne doit pas
 * pouvoir casser le panneau). Mais recopier les drapeaux aurait créé DEUX
 * tables de drapeaux à tenir — et le jour où l'une serait corrigée sans
 * l'autre, la même enseigne aurait deux drapeaux différents selon l'écran.
 * On partage donc le DESSIN, pas la mise en page.
 *
 * Chaque drapeau fait 24 × 16, les proportions réelles d'un drapeau.
 */

/** Drapeaux des 9 langues. */
export const DRAPEAUX = {
  fr: '<rect width="24" height="16" fill="#ffffff"/><rect width="8" height="16" fill="#002395"/>'
    + '<rect x="16" width="8" height="16" fill="#ED2939"/>',
  nl: '<rect width="24" height="16" fill="#ffffff"/><rect width="24" height="5.4" fill="#AE1C28"/>'
    + '<rect y="10.6" width="24" height="5.4" fill="#21468B"/>',
  //  ALLEMAGNE — DÉFAUT CORRIGÉ (signalé par B : « le drapeau de l'Allemagne ne
  //  correspond pas, il faut vérifier les couleurs »).
  //  Le drapeau allemand est NOIR, ROUGE et OR — trois bandes. Le tracé portait
  //  bien le noir en haut et l'or en bas, mais la bande du MILIEU restait le
  //  fond blanc, jamais recouverte : la bande rouge était tout simplement
  //  ABSENTE. On lisait donc un drapeau noir-blanc-or, qui n'existe pas.
  //  Défaut invisible à la relecture du code — les trois rectangles semblaient
  //  là — et criant à l'écran dès qu'on regarde la liste des langues.
  //  Codes officiels : noir #000000, rouge #DD0000, or #FFCE00.
  de: '<rect width="24" height="16" fill="#DD0000"/><rect width="24" height="5.34" fill="#000000"/>'
    + '<rect y="10.66" width="24" height="5.34" fill="#FFCE00"/>',
  en: '<rect width="24" height="16" fill="#012169"/>'
    + '<path d="M0 0 24 16M24 0 0 16" stroke="#ffffff" stroke-width="3.4"/>'
    + '<path d="M0 0 24 16M24 0 0 16" stroke="#C8102E" stroke-width="1.5"/>'
    + '<path d="M12 0V16M0 8H24" stroke="#ffffff" stroke-width="5.4"/>'
    + '<path d="M12 0V16M0 8H24" stroke="#C8102E" stroke-width="3"/>',
  es: '<rect width="24" height="16" fill="#F1BF00"/><rect width="24" height="4" fill="#AA151B"/>'
    + '<rect y="12" width="24" height="4" fill="#AA151B"/>',
  it: '<rect width="24" height="16" fill="#ffffff"/><rect width="8" height="16" fill="#009246"/>'
    + '<rect x="16" width="8" height="16" fill="#CE2B37"/>',
  pt: '<rect width="24" height="16" fill="#FF0000"/><rect width="9.6" height="16" fill="#006600"/>'
    + '<circle cx="9.6" cy="8" r="3.4" fill="#FFD700"/><circle cx="9.6" cy="8" r="1.7" fill="#CE1126"/>',
  pl: '<rect width="24" height="16" fill="#ffffff"/><rect y="8" width="24" height="8" fill="#DC143C"/>',
  sv: '<rect width="24" height="16" fill="#006AA7"/><rect x="7.5" width="3" height="16" fill="#FECC00"/>'
    + '<rect y="7" width="24" height="3" fill="#FECC00"/>',
};

/** Drapeau de l'Europe : bleu à douze étoiles d'or.
 *  Les douze étoiles sont POSÉES EN CERCLE par calcul, pas écrites à la main :
 *  douze coordonnées recopiées finissent toujours par dériver, et un drapeau
 *  européen à onze étoiles est une faute qui se voit. */
export const DRAPEAU_EUROPE = (() => {
  const points = [];
  for (let i = 0; i < 12; i += 1) {
    const a = (i * 30 - 90) * Math.PI / 180;
    points.push(`<use href="#etoileEu" x="${(12 + 5.1 * Math.cos(a)).toFixed(2)}"`
      + ` y="${(8 + 5.1 * Math.sin(a)).toFixed(2)}"/>`);
  }
  return '<defs><path id="etoileEu" d="M0-1.55 L.36-.48 L1.48-.48 L.58,.18 L.91,1.25'
    + ' L0,.6 L-.91,1.25 L-.58,.18 L-1.48-.48 L-.36-.48 Z" fill="#FFCC00"/></defs>'
    + '<rect width="24" height="16" fill="#003399"/>' + points.join('');
})();

/** Drapeaux des PAYS du catalogue. Ce sont ceux des offres, pas ceux des
 *  langues : un Suédois lit les offres de Suède (sv <-> se), un anglophone
 *  celles du Royaume-Uni (en <-> gb), et l'Autriche, la Belgique et l'Irlande
 *  n'ont pas de langue à elles dans l'interface. B a demandé que le pays soit
 *  « aussi avec le drapeau » : sans table dédiée, ces trois-là n'en auraient
 *  pas, et la liste aurait des trous. */
export const DRAPEAUX_PAYS = {
  tout: DRAPEAU_EUROPE,
  fr: DRAPEAUX.fr, nl: DRAPEAUX.nl, de: DRAPEAUX.de, es: DRAPEAUX.es,
  it: DRAPEAUX.it, pt: DRAPEAUX.pt, pl: DRAPEAUX.pl,
  gb: DRAPEAUX.en, se: DRAPEAUX.sv,
  at: '<rect width="24" height="16" fill="#ffffff"/><rect width="24" height="5.4" fill="#ED2939"/>'
    + '<rect y="10.6" width="24" height="5.4" fill="#ED2939"/>',
  be: '<rect width="24" height="16" fill="#FDDA24"/><rect width="8" height="16" fill="#000000"/>'
    + '<rect x="16" width="8" height="16" fill="#EF3340"/>',
  ie: '<rect width="24" height="16" fill="#ffffff"/><rect width="8" height="16" fill="#169B62"/>'
    + '<rect x="16" width="8" height="16" fill="#FF883E"/>',
};

/** Les noms des pays du catalogue, dans notre langue de référence. */
export const NOMS_PAYS = {
  FR: 'France', BE: 'Belgique', DE: 'Allemagne', NL: 'Pays-Bas', ES: 'Espagne',
  IT: 'Italie', AT: 'Autriche', PT: 'Portugal', PL: 'Pologne', SE: 'Suède',
  IE: 'Irlande', GB: 'Royaume-Uni',
};

/** Le dessin d'un drapeau de PAYS, prêt à poser dans un <svg viewBox="0 0 24 16">.
 *  « tout » reçoit le drapeau européen : c'est la portée « tous les pays », et
 *  un drapeau vide à cet endroit ferait un trou dans la liste. */
export const drapeauDe = (code) => DRAPEAUX_PAYS[String(code || '').toLowerCase()] || '';

/** Le drapeau, encadré et prêt à l'emploi — le même dessin sur tous les écrans.
 *  Le liseré est nécessaire : un drapeau à bandes blanches (Pologne, Irlande)
 *  se confondrait sinon avec un fond clair. */
export const svgDrapeau = (code, classe = 'drap') =>
  `<span class="${classe}" aria-hidden="true"><svg viewBox="0 0 24 16">${drapeauDe(code)}</svg></span>`;
