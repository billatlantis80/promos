#!/usr/bin/env node
/**
 * SENTINELLE KREFEL — dit quand l'enseigne est revenue, et si on la lit.
 *
 * Pourquoi ce fichier existe. Le 10/10/2026, B a donné la page de deals de
 * Krefel (`https://www.krefel.be/fr/deals-du-moment?currentPage=2`) pour qu'on
 * la branche au catalogue. Or le site était FERMÉ : HTTP 500 sur toutes ses
 * adresses, avec sa propre phrase de maintenance. Le lecteur a donc été écrit
 * sur une copie ARCHIVÉE — une hypothèse bien fondée, pas un fait vérifié.
 *
 * Cette sentinelle est le chaînon manquant : elle interroge la page vivante,
 * et le jour où Krefel rouvre, elle dit si le lecteur y reconnaît vraiment ses
 * cartes produit. C'est la vérification qui n'a pas pu être faite.
 *
 * RÈGLE DE SILENCE (celle du projet pour tout ce qui tourne en tâche de fond) :
 *   - site encore fermé  -> AUCUNE sortie, code 0. Rien à signaler, on se tait ;
 *   - site revenu        -> une seule ligne, puis on se tait définitivement.
 *
 * Le « une seule fois » est tenu par un fichier témoin : sans lui, la sentinelle
 * parlerait toutes les 20 minutes dès que le site est revenu — exactement le
 * travers qui fait couper la sonnerie d'une alerte (88 messages identiques en
 * quatorze heures, vécu sur ce projet).
 *
 * Lancement : node outils/sentinelle-krefel.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { offresKrefel } from '../collecteur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const TEMOIN = path.join(ICI, '..', 'data', 'sentinelle-krefel.json');
const URL_PAGE = 'https://www.krefel.be/fr/deals-du-moment';
const SOURCE = { id: 'krefel-be-fr', nom: 'Krefel', pays: 'BE', langue: 'fr' };

/** La page de maintenance de l'enseigne, telle qu'elle a été lue. */
const MAINTENANCE = /even niet bereikbaar|temporairement indisponible/i;

function dejaSignale() {
  try {
    const t = JSON.parse(fs.readFileSync(TEMOIN, 'utf8'));
    return t && t.signale === true;
  } catch { return false; }
}

function marquer(etat) {
  try {
    fs.mkdirSync(path.dirname(TEMOIN), { recursive: true });
    fs.writeFileSync(TEMOIN, JSON.stringify({ signale: true, quand: new Date().toISOString(), ...etat }, null, 2));
  } catch { /* un témoin illisible ne doit jamais faire échouer la veille */ }
}

async function lire(url) {
  const r = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'accept-language': 'fr-BE,fr;q=0.9',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  });
  return { code: r.status, corps: await r.text() };
}

try {
  const { code, corps } = await lire(URL_PAGE);

  // 1. Toujours fermé : on se tait. C'est le cas normal de ce soir.
  if (code !== 200 || MAINTENANCE.test(corps)) {
    if (dejaSignale()) process.exit(0);
    process.exit(0);
  }

  // 2. Déjà annoncé une fois : on ne radote pas.
  if (dejaSignale()) process.exit(0);

  // 3. Le site est REVENU : on lit vraiment la page et on rend compte.
  const offres = offresKrefel(corps, SOURCE);
  const promos = offres.filter((o) => o.remise != null);
  const total = (corps.match(/>\s*(\d+)\s*(?:resultaten|résultats)/) || [])[1] || '?';

  if (offres.length > 0) {
    marquer({ offres: offres.length });
    const ex = promos.slice(0, 3).map((o) => `${o.titre.slice(0, 42)} : ${o.prix} € (au lieu de ${o.prixAvant})`).join(' | ');
    console.log(`Krefel est REVENU — le lecteur y reconnaît ses cartes : ${offres.length} offres lues sur ${total} résultats annoncés, dont ${promos.length} avec prix barré. Exemples : ${ex}. Structure de la page vivante CONFIRMÉE, celle du lecteur archivé était la bonne.`);
  } else {
    marquer({ offres: 0 });
    console.log(`Krefel est REVENU mais le lecteur n'y reconnaît AUCUNE carte (0 offre sur ${total} résultats annoncés). La structure mesurée sur l'instantané du 09/06/2026 n'est plus la bonne : le lecteur est à refaire sur la page vivante. Aucune offre Krefel n'entre au catalogue tant que ce n'est pas corrigé.`);
  }
} catch (e) {
  // Panne réseau, DNS, délai : ce n'est pas une nouvelle, on se tait. Une
  // sentinelle qui parle de ses propres difficultés devient du bruit.
  process.exit(0);
}
