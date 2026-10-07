// Mesure du rapport de nuit — règles de B sur les données PUBLIÉES.
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('./docs/offres.json', 'utf8'));
const offres = d.offres || d.offers || [];
console.log('genereLe', d.genereLe, '| offres', offres.length);
console.log('---');

// 1. Comptage par catégorie
const cats = {};
for (const o of offres) cats[o.categorie] = (cats[o.categorie] || 0) + 1;
const ordre = ['tech','electromenager','meubles','maison','mode','auto','jouets','sport','bricolage','beaute','nourriture','animaux','voyages','activite','autre'];
console.log('CATEGORIES (ordre des onglets):');
for (const c of ordre) console.log('  ', c.padEnd(16), cats[c] || 0);
console.log('---');

const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

// helper: compte offres dont le titre contient un des mots, et donne répartition catégorie
function parMot(label, mots, opt={}) {
  const re = new RegExp('(' + mots.map(m=>m.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|') + ')','i');
  const hits = offres.filter(o => re.test(norm(o.titre)));
  const par = {};
  for (const o of hits) par[o.categorie] = (par[o.categorie]||0)+1;
  console.log(`[${label}] total=${hits.length}`, JSON.stringify(par));
  return hits;
}

// 2. TÉLÉVISEURS / ÉCRANS
const tv = parMot('TV/écran', ['televiseur','television\\b','tv ','smart tv',' téléviseur','ecran','bildschirm','moniteur','monitor','fernseher','schermo','televisor','televisore','\\btv\\b']);
console.log('  exemples TV/écran:');
for (const o of tv.slice(0,5)) console.log('   ', o.categorie.padEnd(14), o.pays, '|', o.titre.slice(0,80));

// 3. FRIGO / ASPIRATEUR / SÈCHE-CHEVEUX
for (const [lab, mots] of [
  ['FRIGO/réfrigérateur', ['frigo','refrigerateur','kuhlschrank','fridge','koelkast','nevera','frigorifico','frigorifero','geladeira','lodowka','kylskap']],
  ['ASPIRATEUR', ['aspirateur','vacuum','staubsauger','stofzuiger','aspirador','aspirapolvere','odkurzacz','dammsugare']],
  ['SÈCHE-CHEVEUX', ['seche-cheveux','seche cheveux','hairdryer','haartrockner','fohn','droogkap','secador','asciugacapelli','suszarka','fohnborstel','hairdryer']],
]) {
  parMot(lab, mots);
}
console.log('---');

// 4. RASOIRS / TONDEUSES
parMot('RASOIR', ['rasoir','shaver','rasierer','scheerapparaat','maquina de afeitar','rasoio','cortabarbas','golarka']);
const tond = parMot('TONDEUSE (toutes)', ['tondeuse','trimmer','tondeuse a cheveux','tondeuse barbe','haarschneider','clipper','tondeuse a gazon','lawnmower','rasenmaher','grasmachine','cortacesped','tosaerba','kosiarka','grasklippare']);
console.log('  exemples tondeuse:');
for (const o of tond.slice(0,12)) console.log('   ', o.categorie.padEnd(14), o.pays, '|', o.titre.slice(0,85));
console.log('---');

// 5. SOINS
const soins = parMot('SOINS (spa/massage/bien-être)', ['spa','massage','bien-etre','bien etre','soin','beaute','coiffure','manucure','pedicure','epilation','wellness','massage','reiki']);
const soinsActivite = soins.filter(o=>o.categorie==='activite');
console.log('  SOINS en activite:', soinsActivite.length);
for (const o of soinsActivite.slice(0,8)) console.log('   ', o.pays, '|', o.titre.slice(0,85));
console.log('---');

// 6. ENFANT / FILLE / GARÇON
const enfants = parMot('ENFANT/FILLE/GARCON', ['enfant','fille','garcon','kids','kind','junge','madchen','child','bambini','bambina','nino','nina','ninos','ninas','dziecko','dzieci','barn','bambino']);
console.log('  exemples enfant hors jouets:');
for (const o of enfants.filter(o=>o.categorie!=='jouets').slice(0,15)) console.log('   ', o.categorie.padEnd(14), o.pays, '|', o.titre.slice(0,80));
