import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('./docs/offres.json','utf8'));
const offres = d.offres;
const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

// Vraies TV (produit) en tech : titres qui commencent par une marque + TV/OLED/QLED/Téléviseur
const reTVprod = /(televiseur|\btv\b|fernseher|televisor|televisore|televisao|smart tv|oled tv|qled tv)/;
const tv = offres.filter(o=>reTVprod.test(norm(o.titre)));
const p={}; for(const o of tv)p[o.categorie]=(p[o.categorie]||0)+1;
console.log('TV (mot tv/televiseur):', tv.length, JSON.stringify(p));
for(const o of tv.filter(x=>x.categorie==='tech').slice(0,3)) console.log('  TECH', o.pays,'|', o.titre.slice(0,95));

console.log('---');
// Enfant hors jouets : liste complète
const reEnf = /(\benfant|\benfants|\bfille|\bgarcon|\bkids\b|\bchild\b|\bchildren\b|madchen|\bjunge\b|\bjungen\b|bambini|bambina|\bnino|\bnina|ninos|ninas|niño|niña|niños|niñas|dziecko|dzieci|\bbarn\b|ragazzo|ragazza)/;
const enf = offres.filter(o=>reEnf.test(norm(o.titre)));
const hors = enf.filter(o=>o.categorie!=='jouets');
console.log('ENFANT total', enf.length, '| en jouets', enf.length-hors.length, '| hors jouets', hors.length);
for (const o of hors) console.log('  ', o.categorie.padEnd(14), o.pays,'|', o.titre.slice(0,85));

console.log('---');
// rasoir manuel (lame/jetable/manuel) en électroménager
const man = offres.filter(o=>o.categorie==='electromenager' && /(lame|jetable|manuel|manual|gillette|fusion)/.test(norm(o.titre)));
console.log('rasoir manuel en Électroménager:', man.length);
for(const o of man) console.log('  ', o.pays,'|', o.titre.slice(0,90));
