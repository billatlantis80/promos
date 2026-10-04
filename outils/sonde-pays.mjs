#!/usr/bin/env node
/**
 * Sonde : quelles sources PAR PAYS répondent sans clé ?
 *
 * Aucune supposition : on interroge, on compte les entrées, on jette ce qui ne
 * répond pas. Une source « qui devrait marcher » n'a aucune valeur ici.
 */
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36';

const CANDIDATS = [
  // --- Famille « Pepper » (même moteur que Dealabs) : mêmes chemins de flux ---
  ['DE', 'Dealabs-allemand (mydealz)', 'https://www.mydealz.de/rss/tendance'],
  ['DE', 'mydealz /hot', 'https://www.mydealz.de/rss/hot'],
  ['ES', 'Dealabs-espagnol (chollometro)', 'https://www.chollometro.com/rss/tendance'],
  ['NL', 'Pepper NL', 'https://nl.pepper.com/rss/tendance'],
  ['PL', 'Pepper PL', 'https://www.pepper.pl/rss/tendance'],
  ['UK', 'hotukdeals', 'https://www.hotukdeals.com/rss/tendance'],

  // --- Presse nationale via Google News (sans clé, édition par pays) ---
  ['FR', 'Google News FR', 'https://news.google.com/rss/search?q=bon+plan+promotion&hl=fr&gl=FR&ceid=FR:fr'],
  ['BE', 'Google News BE (fr)', 'https://news.google.com/rss/search?q=bon+plan+promotion&hl=fr&gl=BE&ceid=BE:fr'],
  ['BE', 'Google News BE (nl)', 'https://news.google.com/rss/search?q=koopje+promotie&hl=nl&gl=BE&ceid=BE:nl'],
  ['DE', 'Google News DE', 'https://news.google.com/rss/search?q=Angebot+Rabatt&hl=de&gl=DE&ceid=DE:de'],
  ['NL', 'Google News NL', 'https://news.google.com/rss/search?q=aanbieding+korting&hl=nl&gl=NL&ceid=NL:nl'],
  ['ES', 'Google News ES', 'https://news.google.com/rss/search?q=oferta+descuento&hl=es&gl=ES&ceid=ES:es'],
  ['IT', 'Google News IT', 'https://news.google.com/rss/search?q=offerta+sconto&hl=it&gl=IT&ceid=IT:it'],
  ['AT', 'Google News AT', 'https://news.google.com/rss/search?q=Angebot+Rabatt&hl=de&gl=AT&ceid=AT:de'],
  ['PT', 'Google News PT', 'https://news.google.com/rss/search?q=promo%C3%A7%C3%A3o+desconto&hl=pt&gl=PT&ceid=PT:pt'],
  ['PL', 'Google News PL', 'https://news.google.com/rss/search?q=promocja+zni%C5%BCka&hl=pl&gl=PL&ceid=PL:pl'],
  ['SE', 'Google News SE', 'https://news.google.com/rss/search?q=erbjudande+rabatt&hl=sv&gl=SE&ceid=SE:sv'],
  ['IE', 'Google News IE', 'https://news.google.com/rss/search?q=deal+discount&hl=en&gl=IE&ceid=IE:en'],
];

const entetes = { 'user-agent': UA, accept: 'application/rss+xml, application/xml, text/xml, */*' };
let vivantes = 0;

for (const [pays, nom, url] of CANDIDATS) {
  try {
    const r = await fetch(url, { headers: entetes, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const texte = await r.text();
    const items = (texte.match(/<item[\s>]/g) || []).length;
    const ok = r.ok && items > 0;
    if (ok) vivantes++;
    const premier = (texte.match(/<title>(?:<!\[CDATA\[)?([^<\]]{4,90})/) || [])[1] || '';
    console.log(
      `${ok ? 'VIVANTE ' : 'MORTE   '} ${pays}  ${String(r.status).padEnd(4)} ${String(items).padStart(3)} items  ${nom}`
      + (ok ? `\n            ex. : ${premier.trim()}` : ''),
    );
  } catch (e) {
    console.log(`MORTE   ${pays}  ---  ${nom}  (${e.name || e.message})`);
  }
}
console.log(`\n${vivantes}/${CANDIDATS.length} sources exploitables.`);
