/** État des repos de sources + contrôle des fichiers d'interface. Lecture seule. */
import { readFileSync, statSync } from 'node:fs';
const d = JSON.parse(readFileSync('data/offres.json', 'utf8'));
const vu = d.sourcesVuLe || {};
const now = Math.floor(Date.now() / 1000);
console.log(`maintenant : ${new Date(now * 1000).toISOString()}`);
for (const [k, v] of Object.entries(vu)) {
  if (!/coolblue|enseigne-be/.test(k)) continue;
  console.log(`  ${k.padEnd(46)} ${typeof v === 'number' ? `${new Date(v * 1000).toISOString()} (il y a ${Math.round((now - v) / 60)} min)` : JSON.stringify(v)}`);
}
// Les offres Coolblue « sans 2e prix » sont-elles dans les données publiées
// comme dans celles du collecteur (accumulation) ?
const o = d.offres || d;
const cb = o.filter((x) => x.marchand === 'Coolblue' && !x.prixAvant);
console.log(`\nCoolblue sans 2e prix : ${cb.length}`);
console.log('  3 exemples (prix affiché, date de collecte si présente) :');
for (const x of cb.slice(0, 3)) console.log(`   ${x.prix} € | ${(x.titre || '').slice(0, 60)} | ${x.vuLe || x.ajouteLe || 'sans date'}`);
for (const f of ['public/index.html', 'public/app.js', 'public/langues.js', 'docs/index.html', 'docs/app.js', 'docs/langues.js']) {
  try { const s = statSync(f); console.log(`${f.padEnd(22)} ${String(s.size).padStart(8)} octets  ${s.mtime.toISOString()}`); }
  catch { console.log(`${f.padEnd(22)} ABSENT`); }
}
