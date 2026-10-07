/** SONDE LIDL — la page de promotions demandée par B
 *  (https://www.lidl.fr/q/query/promotions) est-elle exploitable SANS clé, et
 *  existe-t-elle pour les autres pays d'Europe ?
 *
 *  On ne câble RIEN ici : on regarde d'abord. Pour chaque pays on relève le code
 *  HTTP, la taille, le nombre de produits JSON-LD, le nombre de prix lisibles
 *  (deux prix = une vraie promotion) et on nomme deux exemples.
 *
 *  ⚠ Règle de la maison : une source ne se câble qu'après DEUX relevés
 *  identiques. Cette sonde ne fait que le premier. */
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', 'accept-language': 'fr-FR,fr;q=0.9' };
const PAYS = [
  ['FR', 'https://www.lidl.fr/q/query/promotions'],
  ['BE', 'https://www.lidl.be/q/query/promotions'],
  ['BE-nl', 'https://www.lidl.be/nl-BE/q/query/promotions'],
  ['DE', 'https://www.lidl.de/q/query/promotions'],
  ['NL', 'https://www.lidl.nl/q/query/promotions'],
  ['ES', 'https://www.lidl.es/q/query/promotions'],
  ['IT', 'https://www.lidl.it/q/query/promotions'],
  ['AT', 'https://www.lidl.at/q/query/promotions'],
  ['PT', 'https://www.lidl.pt/q/query/promotions'],
  ['PL', 'https://www.lidl.pl/q/query/promotions'],
  ['SE', 'https://www.lidl.se/q/query/promotions'],
  ['IE', 'https://www.lidl.ie/q/query/promotions'],
  ['GB', 'https://www.lidl.co.uk/q/query/promotions'],
];

const eur = (s) => Number(String(s).replace(/[^\d.,]/g, '').replace(',', '.'));

async function sonder([pays, url]) {
  try {
    const r = await fetch(url, { headers: UA, redirect: 'follow' });
    const html = await r.text();
    const ld = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
    let produits = 0;
    for (const bloc of ld) {
      try {
        const j = JSON.parse(bloc.trim());
        const pile = [j];
        while (pile.length) {
          const x = pile.pop();
          if (Array.isArray(x)) { pile.push(...x); continue; }
          if (x && typeof x === 'object') {
            if (x['@type'] === 'Product' || x['@type'] === 'Offer') produits++;
            pile.push(...Object.values(x));
          }
        }
      } catch { /* JSON-LD tronqué */ }
    }
    // Prix lisibles : motifs « 12,99 € » / « 12.99 € » / « 2,49 €/kg »
    const prix = [...html.matchAll(/\b\d{1,4}[.,]\d{2}\s*(?:€|EUR|EUR\b|zl|kr|kr\.)/g)].map((m) => m[0]);
    const noms = [...html.matchAll(/"name"\s*:\s*"([^"]{6,70})"/g)].map((m) => m[1]).slice(0, 2);
    return { pays, statut: r.status, ko: html.length, produits, prix: prix.length, ex: noms };
  } catch (e) {
    return { pays, statut: 'ERR ' + e.message.slice(0, 30), ko: 0, produits: 0, prix: 0, ex: [] };
  }
}

const res = await Promise.all(PAYS.map(sonder));
for (const r of res) {
  console.log(`${r.pays.padEnd(6)} HTTP ${String(r.statut).padEnd(7)} ${String(r.ko).padStart(8)} o  produits JSON-LD ${String(r.produits).padStart(3)}  prix lisibles ${String(r.prix).padStart(4)}  ${r.ex.join(' | ').slice(0, 60)}`);
}
console.log('\n=== DEUXIÈME RELEVÉ (reproductibilité, 4 s plus tard) ===');
await new Promise((s) => setTimeout(s, 4000));
const res2 = await Promise.all(PAYS.map(sonder));
for (let i = 0; i < res.length; i++) {
  const a = res[i], b = res2[i];
  const stable = a.produits === b.produits ? 'STABLE' : 'INSTABLE';
  console.log(`${a.pays.padEnd(6)} produits ${a.produits} → ${b.produits}  prix ${a.prix} → ${b.prix}  ${stable}`);
}
