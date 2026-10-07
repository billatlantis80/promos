import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('./docs/offres.json','utf8'));
const offres = d.offres;
// compte par sourceId / marchand pour les sources neuves
const cible = { coolblue:0, zooplus:0, 'social deal':0, amazon:0, groupon:0 };
const parId = {};
for (const o of offres) {
  const id = o.sourceId || '';
  if (/coolblue|zooplus|socialdeal/i.test(id) || /coolblue|zooplus|social deal/i.test(o.marchand||'')) {
    parId[id] = (parId[id]||0)+1;
  }
}
console.log('Offres par sourceId neuve:', JSON.stringify(parId, null, 1));

// par pays pour ces sources
for (const key of ['coolblue','zooplus','socialdeal']) {
  const par = {};
  for (const o of offres) {
    const s = ((o.sourceId||'')+' '+(o.marchand||'')).toLowerCase();
    if (s.includes(key)) par[o.pays]=(par[o.pays]||0)+1;
  }
  console.log(key, '→', JSON.stringify(par));
}

// marches / sources distinctes
const srcs = new Set(offres.map(o=>o.sourceId).filter(Boolean));
console.log('sources distinctes (sourceId):', srcs.size);
const marches = new Set(offres.map(o=>o.marchand).filter(Boolean));
console.log('marchands distincts:', marches.size);
