/** Coolblue après lecture du prix de référence + composition belge. */
import fs from 'node:fs';
import vm from 'node:vm';

const brut = JSON.parse(fs.readFileSync(new URL('../docs/offres.json', import.meta.url), 'utf8'));
const offres = Array.isArray(brut) ? brut : brut.offres;
const js = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const d = js.indexOf('const REMISE_MIN');
const f = js.indexOf('/** Une offre passe-t-elle les filtres courants ? */');
const ctx = vm.createContext({});
const R = vm.runInContext(`${js.slice(d, f)}
  ;({ estAmazon, estPromoVerifiee, estOffreEnseigne, estBonPlanPresse, estBonneAffaire, estBonnePromo, paysDe, dedoublonner, melanger, remiseMontrable })`, ctx);

const cb = offres.filter((o) => o.marchand === 'Coolblue');
console.log(`Coolblue : ${cb.length} offres collectées`);
console.log(`   avec un prix de référence : ${cb.filter((o) => o.prixAvant != null).length}`);
console.log(`   avec une remise calculée  : ${cb.filter((o) => o.remiseCalculee).length}`);
console.log(`   RETENUES par la règle     : ${cb.filter(R.estBonnePromo).length}`);
console.log('');
for (const o of cb.filter(R.estBonnePromo).sort((a, b) => (b.remise || 0) - (a.remise || 0)).slice(0, 15)) {
  console.log(`   -${o.remise} % · ${o.prix} € au lieu de ${o.prixAvant} € · ${String(o.titre).slice(0, 50)}`);
}

const cmp = (a, b) => (R.estPromoVerifiee(b) ? 1 : 0) - (R.estPromoVerifiee(a) ? 1 : 0)
  || (b.remise || 0) - (a.remise || 0) || (b.temperature || 0) - (a.temperature || 0);
for (const pays of ['BE', 'NL', 'FR', 'DE']) {
  const du = offres.filter((o) => R.paysDe(o) === pays && R.estBonnePromo(o));
  const m = R.melanger(R.dedoublonner(du), cmp);
  const nAmz = m.filter(R.estAmazon).length;
  const cat = (o) => (R.estPromoVerifiee(o) ? '2 prix' : (R.estOffreEnseigne(o) ? 'enseigne' : (R.estBonPlanPresse(o) ? 'presse' : 'bonne affaire')));
  const c = {};
  for (const o of m.filter((x) => !R.estAmazon(x))) c[cat(o)] = (c[cat(o)] || 0) + 1;
  console.log(`\n${pays} : ${m.length} lignes · ${nAmz} Amazon · ${m.length - nAmz} autres ${JSON.stringify(c)}`);
}
