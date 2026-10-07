import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('./docs/offres.json','utf8'));
const offres = d.offres;

// Cross-tab ACTIVITÉ pays × marchand
const act = offres.filter(o=>o.categorie==='activite');
const tab = {};
for (const o of act) { const k=o.pays+'|'+(o.marchand||o.source||'?'); tab[k]=(tab[k]||0)+1; }
console.log('ACTIVITÉ pays|source:');
for (const [k,v] of Object.entries(tab).sort()) console.log('  ', k, v);

console.log('---');
// rasoirs manuels éventuellement en électroménager
const ras = offres.filter(o=>/rasoir|shaver|rasierer|gillete|gillette|manual|jetable|lame/.test((o.titre||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')));
console.log('titres rasoir/manuel:', ras.length);
for (const o of ras.filter(o=>o.categorie==='electromenager').slice(0,15)) console.log('  [EM]', o.titre.slice(0,80));

console.log('---');
// électroménager : exemples pour prouver l'onglet
const em = offres.filter(o=>o.categorie==='electromenager');
console.log('ÉLECTROMÉNAGER total:', em.length);
for (const o of em.slice(0,6)) console.log('  ', o.pays,'|', o.titre.slice(0,75));

console.log('---');
// tondeuse à gazon : déjà OK. Ajout : recherche mot nu 'tondeuse' en bricolage pour cheveux
const tondBr = offres.filter(o=>o.categorie==='bricolage' && /tondeuse/.test((o.titre||'').toLowerCase()));
console.log('« tondeuse » en bricolage:', tondBr.length, '(toutes gazon ?)');
const suspect = tondBr.filter(o=>/cheveux|barbe|beard|hair|poil/.test(o.titre.toLowerCase()));
console.log('  dont cheveux/barbe (doit être 0):', suspect.length, suspect.map(o=>o.titre.slice(0,60)));

console.log('---');
// soins beauté : massage en activite ?
const soinAct = offres.filter(o=>o.categorie==='activite' && /(massage|spa|soin|bien-etre|bien etre|beaute|coiffure|manucure|pedicure|epilation|reiki|wellness)/.test((o.titre||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')));
console.log('SOINS en Activité:', soinAct.length);
for (const o of soinAct) console.log('  ', o.pays,'|', o.titre.slice(0,80));
