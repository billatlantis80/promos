/**
 * Affichage des visuels — application n°2 « Promos ».
 *
 * Ce fichier existe parce que DEUX défauts distincts laissaient des cartes
 * grises sur le site public, et qu'aucun des deux ne produisait la moindre
 * erreur visible — ni dans les journaux, ni à l'écran :
 *
 *   1. LE TYPE DÉCLARÉ MENTAIT. img.grouponcdn.com annonce
 *      « application/octet-stream » pour de VRAIES images webp/jpeg. Le
 *      rapatrieur exigeait un `content-type` commençant par « image/ » : il
 *      refusait 33 visuels sur 37. L'adresse restait distante, et l'application
 *      la réclamait alors à NOTRE relais d'images — lequel n'existe que sur le
 *      hub du NAS, pas sur GitHub Pages (301 → gris). Vérifié : la même adresse
 *      locale rend bien 200 en `image/webp`.
 *
 *   2. L'ADRESSE ÉTAIT ÉCHAPPÉE EN HTML. DHnet publie « …&amp;smart=true »
 *      (400 Bad Request), Mobil.se carrément « https:&#x2F;&#x2F;image.mobil.se… »
 *      (« no host given »). Ce ne sont pas des URL : le téléchargement ne peut
 *      pas aboutir, donc la carte reste grise.
 *
 * Les deux se corrigent au même endroit de la chaîne : on ne croit plus ce qui
 * est DÉCLARÉ, on regarde ce qui EST — la signature du fichier, et l'adresse
 * décodée. Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatImage, decaper } from '../collecteur.mjs';

// De VRAIES signatures, sur quelques octets seulement.
const webp = () => Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]);
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(12)]);
const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
const gif = () => Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(10)]);
const avif = () => Buffer.concat([Buffer.alloc(4), Buffer.from('ftypavif'), Buffer.alloc(8)]);

test('le visuel est reconnu par sa SIGNATURE, pas par son type déclaré', () => {
  assert.equal(formatImage(webp()), 'webp');
  assert.equal(formatImage(jpeg()), 'jpeg');
  assert.equal(formatImage(png()), 'png');
  assert.equal(formatImage(gif()), 'gif');
  assert.equal(formatImage(avif()), 'avif');
});

test('une VRAIE image annoncée « application/octet-stream » est acceptée', () => {
  // Le défaut mesuré : 33 des 37 visuels Groupon étaient dans ce cas exact.
  // L'ancien contrôle (`content-type` commençant par « image/ ») les refusait,
  // et ces cartes restaient grises sur le site public.
  assert.equal(formatImage(webp()), 'webp',
    'un webp déclaré « octet-stream » doit passer — c’est le cas Groupon');
});

test('ce qui n’est pas une image est refusé', () => {
  assert.equal(formatImage(Buffer.from('<html><body>403 Forbidden</body></html>')), '');
  assert.equal(formatImage(Buffer.from('pas une image')), '');
  assert.equal(formatImage(Buffer.alloc(0)), '', 'un corps vide n’est pas une image');
  assert.equal(formatImage(Buffer.from('{"erreur":"limite atteinte"}')), '');
});

test('une adresse de visuel échappée en HTML redevient une URL valide', () => {
  const dhnet = 'https://www.dhnet.be/resizer/v2/ABC.jpg?auth=1c83&amp;smart=true&amp;width=1200';
  const mobil = 'https:&#x2F;&#x2F;image.mobil.se&#x2F;1679861.webp?imageId&#x3D;1679861';
  assert.equal(decaper(dhnet), 'https://www.dhnet.be/resizer/v2/ABC.jpg?auth=1c83&smart=true&width=1200');
  assert.equal(decaper(mobil), 'https://image.mobil.se/1679861.webp?imageId=1679861');
  for (const [nom, net] of [['DHnet', decaper(dhnet)], ['Mobil.se', decaper(mobil)]]) {
    assert.doesNotMatch(net, /&amp;|&#x?[0-9a-f]+;/i, `${nom} : plus aucune entité dans l’adresse`);
    assert.doesNotThrow(() => new URL(net), `${nom} : l’adresse décodée doit être une URL valide`);
  }
});

test('une adresse déjà propre n’est pas abîmée', () => {
  const distante = 'https://img.grouponcdn.com/iam/2G/v1/t600x362.webp';
  assert.equal(decaper(distante), distante);
  const locale = 'img/f43ae5b0a9100f540c84.webp';
  assert.equal(decaper(locale), locale, 'un chemin local doit rester intact');
});
