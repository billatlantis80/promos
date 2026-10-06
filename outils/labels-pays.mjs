/** Affiche les étiquettes de marchands déclarées, par pays. */
import { TOUTES_SOURCES } from '../collecteur.mjs';

const pays = process.argv[2] || 'BE';
const noms = [...new Set(TOUTES_SOURCES.filter((s) => s.pays === pays).map((s) => s.nom))].sort();
console.log(`${pays} — ${noms.length} étiquettes :`);
console.log(noms.join(' · '));
const suspects = noms.filter((n) => n.length <= 6 && !['Aldi', 'OKay', 'Hubo', 'Hema', 'JBC', 'Fun', 'Spar', 'Torfs'].includes(n));
console.log('');
console.log(`à vérifier (noms très courts) : ${suspects.join(', ') || 'aucun'}`);
