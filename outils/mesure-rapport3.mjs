import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('./docs/offres.json','utf8'));
const offres = d.offres;
const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

const re = /(\bteleviseur|\btelevision|\bsmart ?tv\b|\boled\b|\bqled\b|\bfernseher\b|\btelevisor|\btelevisore|\btelevisao|\btelevisie|\b4k tv\b|ambilight|\btv led\b|\btv 4k\b)/;
const tv = offres.filter(o=>re.test(norm(o.titre)));
const p={}; for(const o of tv)p[o.categorie]=(p[o.categorie]||0)+1;
console.log('TV (cible):', tv.length, JSON.stringify(p));
console.log('hors tech:');
for(const o of tv.filter(x=>x.categorie!=='tech')) console.log('  ', o.categorie.padEnd(12), o.pays,'|', o.titre.slice(0,85));
console.log('3 exemples tech:');
for(const o of tv.filter(x=>x.categorie==='tech').slice(0,3)) console.log('  ', o.pays,'|', o.titre.slice(0,95));

console.log('---');
const act = offres.filter(o=>o.categorie==='activite');
const parPays={}, parSource={};
for(const o of act){parPays[o.pays]=(parPays[o.pays]||0)+1; const s=(o.marchand||o.source||'?'); parSource[s]=(parSource[s]||0)+1;}
console.log('ACTIVITÉ par pays:', JSON.stringify(parPays));
console.log('ACTIVITÉ par source:', JSON.stringify(parSource));

const voy=offres.filter(o=>o.categorie==='voyages'); const vp={}; for(const o of voy)vp[o.pays]=(vp[o.pays]||0)+1;
console.log('VOYAGES par pays:', JSON.stringify(vp));
const ani=offres.filter(o=>o.categorie==='animaux'); const ap={}; for(const o of ani)ap[o.pays]=(ap[o.pays]||0)+1;
console.log('ANIMAUX par pays:', JSON.stringify(ap));
