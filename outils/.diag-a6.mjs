import fs from 'node:fs';
import { classerOffre } from '../collecteur.mjs';

const CAS = [
  // A4 — sous-chaînes pures
  ['Skullcandy Crusher EVO Cascos Inalámbricos Bluetooth', 'High-tech'],
  ['Philips Lumea serie 8000, dispositivo de depilación IPL', 'Beauté'],
  ['Philips OneBlade 360 Recortadora para Barba y Cuerpo', 'Électroménager'],
  ['SONGMICS Rangements pour Placards de Cuisine, Lot de 2, Empilables', 'Maison'],
  ['Opret Pilulier Semainier Français (Matin, Midi, Soir et Nuit)', 'Maison'],
  ['Recopilación de libros reacondicionados', 'Autres'],
  ['Recopilacion de panderetas musicales', 'Autres'],
  ['Recopilatorio Chollo! 16 Cursos de Udemy', 'Autres'],
  ['roborock F25 GT Gen 2 Set Nass-Trockensauger', 'Électroménager'],
  ['Amazon Kindle Paperwhite 16 GB (Version 2024)', 'High-tech'],
  ['Govee Lampa stołowa LED, lampka nocna, dotykowa, ściemniana', 'High-tech'],
  ['Seiko Clocks Zegar ścienny QXA831S / QXA831K', 'Maison'],
  ['Władca Pierścieni J.R.R. Tolkien książki - trylogia', 'Autres'],
  ['[Warszawa / Śródmieście] Bezpłatne USG piersi i badania genetyczne', 'Activité'],
  ['Liście spadają i ceny również. Hitowa strategia', 'Autres'],
  ['TENA Men Absorbent Protector Incontinence Pads', 'Beauté'],
  ['Philips Hue Essential Smart LED A60 E27, 4-pack', 'High-tech'],
  ['ECOWITT Väderstation med utomhussensor HP2564, wifi', 'High-tech'],
  ['ToolSpace Balayette en Bois - Brosse 58 cm', 'Maison'],
  // A3 — figur / baby
  ['Fire TV Stick HD', 'High-tech'],
  ['BaByliss Tondeuse à poils', 'Électroménager'],
  // A4 inoffensifs (doivent RESTER bricolage)
  ['Dremel 4250 Multitool rotatiegereedschapset', 'Bricolage'],
  ['WAGNER Airless verfspuitsysteem', 'Bricolage'],
  ['Bosch Professional planslip GSS 18V-13', 'Bricolage'],
  // A5 — Maison → Nourriture / Électroménager
  ['Diplomático Reserva Exclusiva Rum 0,7 l', 'Nourriture'],
  ['Woodford Reserve Bourbon Whiskey 0,7 l', 'Nourriture'],
  ['Lotus Biscoff Kekse 4 x 250g', 'Nourriture'],
  ['kinder Schokolade 300g', 'Nourriture'],
  ['Segafredo Zanetti Espresso Kaffeebohnen 1 kg', 'Nourriture'],
  ['[Lidl+] Pommes de Terre Four - 2.5 Kg', 'Nourriture'],
  ['Hisense WF1G7021BW 7kg Washing Machine', 'Électroménager'],
  ['Zamrażarka Bomann 143 cm', 'Électroménager'],
  ['Samsung Jet 75E Stick Vacuum Cleaner', 'Électroménager'],
  ['Philips Fusselrasierer GC026/00', 'Électroménager'],
  // A5 — Beauté → Électroménager
  ['Braun Rasierer Herren Elektrisch Series 9 9100si', 'Électroménager'],
  ['Philips Series 700 Rasierer (S792/06)', 'Électroménager'],
  ['Philips OneBlade Intimate QP1930/34', 'Électroménager'],
  ['Philips Shaver 5000', 'Électroménager'],
  ['Trymer Philips Multigroom 12w1', 'Électroménager'],
  ['Wahl 5606-508 Cortabarbas', 'Électroménager'],
  // A5 — Auto → Jouets
  ['Pack de 5 coches Hot Wheels - Mattel', 'Jeux & jouets'],
  // A4 effets de bord
  ['Tondeuse thermique tractée', 'Bricolage'],
  ['Rasoir manuel 5 lames Gillette', 'Beauté'],
];

for (const [t, attendu] of CAS) {
  const r = classerOffre({ titre: t, categorieSource: '' });
  const ok = r === attendu ? 'OK ' : '>> ';
  console.log(`${ok}[${r}]  (attendu: ${attendu})  ${t}`);
}
