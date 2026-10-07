/** Ajoute les DEUX derniers libellés du bandeau d'état aux NEUF dictionnaires :
 *  le message d'affiliation non configurée et le message hors ligne. Ce sont les
 *  deux seules phrases encore en français au milieu d'une interface traduite
 *  (relevé sur la capture d'écran du 7/10).
 *  Idempotent. La clé française sert de clé, comme partout dans langues.js. */
import { readFileSync, writeFileSync } from 'node:fs';
import { t, definirLangue } from '../public/langues.js';

const CHEMIN = '/opt/data/webdev/projects/promos/public/langues.js';
const A_FR = "<b>À activer</b> : l'identifiant d'affiliation n'est pas encore renseigné (fichier <code>affiliation.js</code>). Les liens sortent donc en direct, sans commission.";
const B_FR = "<b>Hors ligne</b> : le serveur des promos est injoignable. La liste ci-dessous est l'instantané embarqué du {n} ; les visuels ne sont pas disponibles.";

// Pour chaque langue : [clé d'affiliation, clé hors ligne]
const TRAD = {
  fr: [A_FR, B_FR],
  nl: ["<b>Te activeren</b> : de affiliate-ID is nog niet ingevuld (bestand <code>affiliation.js</code>). De links gaan dus rechtstreeks, zonder commissie.",
    "<b>Offline</b> : de promotieserver is onbereikbaar. De lijst hieronder is de ingebouwde momentopname van {n} ; de beelden zijn niet beschikbaar."],
  de: ["<b>Zu aktivieren</b> : Die Affiliate-ID ist noch nicht eingetragen (Datei <code>affiliation.js</code>). Die Links führen daher direkt, ohne Provision.",
    "<b>Offline</b> : Der Angebotsserver ist nicht erreichbar. Die Liste unten ist der eingebettete Schnappschuss vom {n} ; die Bilder sind nicht verfügbar."],
  en: ["<b>To activate</b>: the affiliate ID has not been filled in yet (file <code>affiliation.js</code>). Links therefore go direct, with no commission.",
    "<b>Offline</b>: the deals server is unreachable. The list below is the built-in snapshot from {n}; images are not available."],
  es: ["<b>Por activar</b>: el identificador de afiliación aún no está rellenado (archivo <code>affiliation.js</code>). Los enlaces salen directos, sin comisión.",
    "<b>Sin conexión</b>: el servidor de ofertas no responde. La lista de abajo es la instantánea integrada del {n}; las imágenes no están disponibles."],
  it: ["<b>Da attivare</b>: l'identificativo di affiliazione non è ancora inserito (file <code>affiliation.js</code>). I link escono quindi diretti, senza provvigione.",
    "<b>Offline</b>: il server delle offerte non è raggiungibile. L'elenco qui sotto è l'istantanea integrata del {n}; le immagini non sono disponibili."],
  pt: ["<b>Por ativar</b>: o identificador de afiliação ainda não está preenchido (ficheiro <code>affiliation.js</code>). Os links saem diretos, sem comissão.",
    "<b>Offline</b>: o servidor de promoções está inacessível. A lista abaixo é a captura integrada de {n}; as imagens não estão disponíveis."],
  pl: ["<b>Do aktywacji</b>: identyfikator afiliacyjny nie został jeszcze wpisany (plik <code>affiliation.js</code>). Linki prowadzą więc bezpośrednio, bez prowizji.",
    "<b>Offline</b>: serwer promocji jest nieosiągalny. Lista poniżej to wbudowany zapis z {n}; obrazy są niedostępne."],
  sv: ["<b>Att aktivera</b>: affiliate-ID:t är ännu inte ifyllt (filen <code>affiliation.js</code>). Länkarna går därför direkt, utan provision.",
    "<b>Offline</b>: erbjudandeservern är onåbar. Listan nedan är den inbyggda ögonblicksbilden från {n}; bilderna är inte tillgängliga."],
};

let src = readFileSync(CHEMIN, 'utf8');
if (src.includes('affiliate-ID') || src.includes('Affiliate-ID')) {
  console.log('clés déjà présentes — rien à faire');
  process.exit(0);
}
const lignes = src.split('\n');
const cibles = [];
lignes.forEach((l, i) => { if (/^  'À activer': '.*',$/.test(l)) cibles.push(i); });
if (cibles.length !== 9) {
  console.log(`ATTENDU 9 dictionnaires, trouvé ${cibles.length} — rien écrit (sécurité)`);
  process.exit(1);
}
const ordre = ['fr', 'nl', 'de', 'en', 'es', 'it', 'pt', 'pl', 'sv'];
for (let k = cibles.length - 1; k >= 0; k--) {
  const [a, b] = TRAD[ordre[k]];
  const q = (s) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  lignes.splice(cibles[k] + 1, 0, `  ${q(A_FR)}: ${q(a)},`, `  ${q(B_FR)}: ${q(b)},`);
}
writeFileSync(CHEMIN, lignes.join('\n'));
console.log(`2 clés ajoutées dans ${cibles.length} dictionnaires (ordre : ${ordre.join(', ')})`);

// Contrôle immédiat : les mêmes phrases, relues par le moteur, dans 4 langues.
for (const code of ['fr', 'de', 'nl', 'sv']) {
  definirLangue(code);
  const a = t(A_FR);
  const b = t(B_FR, { n: '7.10.2026' });
  console.log(`  [${code}] ${a.slice(0, 58)}… / ${b.slice(0, 52)}…`);
  if (a === A_FR && code !== 'fr') console.log(`     ⚠ RESTÉ EN FRANÇAIS en ${code}`);
}
