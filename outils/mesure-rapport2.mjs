import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('./docs/offres.json', 'utf8'));
const offres = d.offres || [];
const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

// --- TV/écrans : cible forte (téléviseur, écran, monitor, fernseher, TV)
const reTV = /\b(tv|televiseur|television|fernseher|televisor|televisore|televisao|monitor|moniteur|ecran|schermo|pantalla|bildschirm|beamer|projecteur|projector)/;
const tv = offres.filter(o => reTV.test(norm(o.titre)));
const tvHorsTech = tv.filter(o => o.categorie!=='tech');
console.log('TV/ÉCRAN: total', tv.length, '| hors tech', tvHorsTech.length);
for (const o of tvHorsTech) console.log('   ', o.categorie.padEnd(14), o.pays, '|', o.titre.slice(0,90));
console.log('---');

// --- Tondeuse à gazon
const gaz = offres.filter(o => /(tondeuse a gazon|tondeuse gazon|robot tondeuse|gazon|lawnmower|lawn mower|rasenmaher|rasenmäher|grasmachine|grasmaaier|cortacesped|cortacespa|tosaerba|kosiarka|grasklippare)/.test(norm(o.titre)));
const parGaz = {}; for (const o of gaz) parGaz[o.categorie]=(parGaz[o.categorie]||0)+1;
console.log('TONDEUSE À GAZON / gazon:', gaz.length, JSON.stringify(parGaz));
for (const o of gaz.slice(0,10)) console.log('   ', o.categorie.padEnd(14), o.pays, '|', o.titre.slice(0,85));
console.log('---');

// --- Tondeuse à cheveux / barbe
const cheveux = offres.filter(o => /(tondeuse a cheveux|tondeuse cheveux|tondeuse barbe|tondeuse pour barbe|haarschneider|hair clipper|clipper|harklipp|hårklipp|tondeuse)/.test(norm(o.titre)));
const parCh = {}; for (const o of cheveux) parCh[o.categorie]=(parCh[o.categorie]||0)+1;
console.log('TONDEUSE (générique) par cat:', cheveux.length, JSON.stringify(parCh));
console.log('  | bricolage:', cheveux.filter(o=>o.categorie==='bricolage').map(o=>o.titre.slice(0,60)));
console.log('  | beaute:', cheveux.filter(o=>o.categorie==='beaute').map(o=>o.titre.slice(0,60)));
console.log('---');

// --- Rasoir en beauté
const rasoir = offres.filter(o => /(rasoir|shaver|rasierer|scheerapparaat|maquina de afeitar|rasoio|cortabarbas|golarka)/.test(norm(o.titre)));
console.log('RASOIR en beauté:', rasoir.filter(o=>o.categorie==='beaute').map(o=>o.titre.slice(0,80)));
console.log('---');

// --- Enfant : cible forte (mots entiers enfant/fille/garcon + langues)
const reEnf = /(\benfant|\benfants|\bfille|\bgarcon|pour enfants|pour enfant|\bkids\b|\bchild\b|\bchildren\b|madchen|\bjunge\b|\bjungen\b|bambini|bambina|\bnino|\bnina|ninos|ninas|niño|niña|niños|niñas|dziecko|dzieci|barn\b|ragazzo|ragazza)/;
const enf = offres.filter(o => reEnf.test(norm(o.titre)));
const parEnf = {}; for (const o of enf) parEnf[o.categorie]=(parEnf[o.categorie]||0)+1;
console.log('ENFANT (mots forts):', enf.length, JSON.stringify(parEnf));
console.log('  hors jouets:');
for (const o of enf.filter(o=>o.categorie!=='jouets')) console.log('   ', o.categorie.padEnd(14), o.pays, '|', o.titre.slice(0,85));
