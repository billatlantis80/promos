import fs from 'node:fs';
import vm from 'node:vm';
const brut = JSON.parse(fs.readFileSync(new URL('../docs/offres.json', import.meta.url), 'utf8'));
const offres = Array.isArray(brut) ? brut : brut.offres;
const js = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const d = js.indexOf('const REMISE_MIN');
const f = js.indexOf('/** Une offre passe-t-elle les filtres courants ? */');
const ctx = vm.createContext({});
const R = vm.runInContext(`${js.slice(d, f)}
  ;({ estBonnePromo, estBonneAffaire, estOffreEnseigne, estBonPlanPresse, estPromoVerifiee, estAmazon })`, ctx);

for (const o of offres.filter((x) => x.marchand === 'Coolblue' && R.estBonnePromo(x))) {
  console.log('---');
  console.log('  titre      :', String(o.titre).slice(0, 60));
  console.log('  sourceId   :', o.sourceId, '| categorieSource :', o.categorieSource);
  console.log('  prix       :', o.prix, '| prixAvant :', o.prixAvant, '| remise :', o.remise, '| calc :', o.remiseCalculee);
  console.log('  temperature:', o.temperature);
  console.log('  estPromoVerifiee :', R.estPromoVerifiee(o), '| estOffreEnseigne :', R.estOffreEnseigne(o),
    '| estBonPlanPresse :', R.estBonPlanPresse(o), '| estBonneAffaire :', R.estBonneAffaire(o));
}
