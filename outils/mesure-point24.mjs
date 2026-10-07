/** Sonde de mesure du POINT 24 — l'appareil électroménager nommé l'emporte-t-il
 *  sur le marqueur d'enfant, sans déborder ailleurs ? (outil jetable) */
import { famille } from '../collecteur.mjs';
const cas = [
  ['Tondeuse à cheveux enfant Wahl', ''],
  ['Brosse à dents électrique Oral-B Kids', ''],
  ['Brosse à dents Kids 2-6 ans', 'Beauté'],
  ['Rasoir électrique pour homme', ''],
  ['Casque audio enfant Bluetooth', ''],
  ['Téléviseur enfant LG 32 pouces', ''],
  ['Ours en peluche enfant 40 cm', ''],
  ['Tondeuse à gazon enfant', ''],
  ['Brosse à dents enfant manuelle', ''],
  ['Machine à café jouet pour enfant', ''],
  ['LEGO Batman pour enfant (PS5)', ''],
  ['Sèche-cheveux enfant', ''],
  ['Veilleuse enfant', ''],
  ['Étagère à jouets enfant', ''],
];
for (const [t, c] of cas) {
  const f = famille(t, c);
  console.log(`${f === 'electromenager' ? '»' : ' '} ${f.padEnd(15)} | ${t}`);
}
