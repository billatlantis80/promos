/**
 * FABRIQUE L'APERÇU DU MESSAGE DE CONFIRMATION — à partir du VRAI code.
 *
 * Ce n'est pas une maquette : le HTML est produit par la fonction
 * `corpsHtmlConfirmation` du script, exactement celle qui partira dans les
 * messages. Seuls deux détails changent, et ils ne touchent pas la mise en page :
 *   · le logo (`cid:logo`) devient une image incorporée, pour qu'un navigateur
 *     puisse l'afficher ;
 *   · le lien porte une adresse de exemple, jamais un vrai jeton.
 *
 *   node outils/apercu-mail.mjs > /tmp/apercu-mail.html
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const PROJET = path.dirname(ICI);
const source = fs.readFileSync(path.join(PROJET, 'outils', 'tableau-inscription.gs'), 'utf8');

const ctx = vm.createContext({ console, JSON, Math, Date, String, Object, Array, RegExp, isNaN, parseInt, parseFloat });
vm.runInContext(source, ctx);

const ADRESSE = 'https://script.google.com/macros/s/AKfycbw_8HLvk0hX9G2ssh5WfoZRFalZ6L6clNEvls2BCiNFQ-fiohdyTIA1hH0TCz8uFnv_/exec';
const JETON = '5d1ddb5d7f9940ad8d91547a70253683';
const langue = process.argv[2] || 'fr';
const html = vm.runInContext(
  `corpsHtmlConfirmation(textes('${langue}'), courts('${langue}'), `
  + `'${ADRESSE}?jeton=${JETON}', '${ADRESSE}?desinscrire=${JETON}', true)`,
  ctx,
);

const logo = fs.readFileSync(path.join(PROJET, 'identite', 'mail-logo.png')).toString('base64');
// Le cadre gris imite la fenêtre d'un lecteur de courrier : on juge le message
// tel qu'il arrive, pas collé au bord de l'écran.
const page = `<!doctype html><html lang="${langue}"><head><meta charset="utf-8">
<title>Aperçu — message de confirmation (${langue})</title></head>
<body style="margin:0;background:#f4f6f8">
<div style="background:#e8ebef;border-bottom:1px solid #d7dce2;padding:10px 16px;
  font:13px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#5c6b76">
  <b style="color:#0d3b5b">Kazendra</b> — Confirme ton inscription &nbsp;|&nbsp; à moi
</div>
${html.replace('cid:logo', 'data:image/png;base64,' + logo)}
</body></html>`;
process.stdout.write(page);
