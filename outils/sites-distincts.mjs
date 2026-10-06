/** Liste des SITES distincts (domaines), par famille — pour répondre « quels sites ». */
import { TOUTES_SOURCES } from '../collecteur.mjs';

const domaine = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return String(u); } };
const parType = {};
for (const s of TOUTES_SOURCES) (parType[s.type] = parType[s.type] || []).push(s);

const NOM = {
  flash: 'AMAZON — ventes flash du jour (/gp/goldbox)',
  amazon: 'AMAZON — recherche filtrée « en promotion »',
  enseigne: 'ENSEIGNES — page d’offres officielle',
  dealabs: 'COMMUNAUTÉS DE BONS PLANS (RSS public)',
};
for (const t of ['flash', 'amazon', 'enseigne', 'dealabs']) {
  const lot = parType[t] || [];
  const d = {};
  for (const s of lot) d[domaine(s.url)] = (d[domaine(s.url)] || 0) + 1;
  console.log(`\n=== ${NOM[t]} — ${lot.length} flux, ${Object.keys(d).length} site(s) ===`);
  for (const [dom, n] of Object.entries(d)) console.log(`   ${dom} (${n} flux)`);
}

// Presse / veille : on sépare les vrais médias des enseignes surveillées.
const presse = parType.presse || [];
const d = {};
for (const s of presse) d[domaine(s.url)] = { n: (d[domaine(s.url)]?.n || 0) + 1, pays: s.pays };
console.log(`\n=== PRESSE, BING & VEILLE ENSEIGNES — ${presse.length} flux, ${Object.keys(d).length} sites ===`);
const liste = Object.entries(d).sort((a, b) => b[1].n - a[1].n);
for (const [dom, info] of liste) console.log(`   ${dom} ${info.pays || ''} (${info.n})`);
