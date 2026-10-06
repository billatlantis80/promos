# Traductions de « Promos » — spécification et plan de nuit

> Ce fichier est écrit pour être lu par une session **neuve**, sans mémoire de la
> conversation. Il contient la décision, le dessin technique exact, et les unités
> de travail à exécuter dans l'ordre. Lire EN ENTIER avant de toucher au code.

## 1. Décision d'architecture — arrêtée par B, non négociable

**La langue est une préférence d'UTILISATEUR. Elle n'est JAMAIS une propriété du
pays des offres.**

- Un utilisateur choisit SA langue dans le panneau de configuration (Réglages).
- Il peut ensuite consulter les offres de **n'importe quel pays** : l'interface
  reste dans SA langue.
  Exemple donné par B : *« Si un Allemand utilise l'application en allemand il
  aura le droit d'aller dans tous les autres pays et tout sera traduit en
  allemand. »*
- **Belgique** : français ET néerlandais doivent être proposés, au choix. Un
  utilisateur francophone garde le droit de consulter les autres pays **en
  français**, puisqu'il a choisi ce paramètre.
- Le choix vaut pour **l'application ET le site internet** — c'est le même code
  (`public/`), donc la même mécanique sert les deux.

**9 langues** : `fr` (source), `nl`, `de`, `en`, `es`, `it`, `pt`, `pl`, `sv`.
(12 pays couverts, 9 langues.)

**Défaut** : la langue du navigateur si elle est dans la liste, sinon `fr`.

**Décision de B sur les titres d'offres** (à respecter, pas à réinterpréter) :

- Le **titre d'origine est CONSERVÉ** quand il est lié à une **marque**.
- **Seul le vocabulaire courant** est traduit.
- Les **informations techniques et spécifiques** du produit ne sont **JAMAIS**
  touchées : références, modèles, capacités, unités, dimensions, compatibilités.
- Conséquence pratique : la traduction des titres est **prudente et partielle**,
  et un titre est **laissé intact dès qu'un doute existe**. Un titre mal traduit
  ferait dire à un marchand ce qu'il n'a pas dit — c'est pire que pas de
  traduction. **L'interface, elle, est traduite intégralement** : c'est la partie
  certaine et le cœur du travail.

Aucune clé d'API n'est utilisée (règle du projet : services gratuits sans clé).

## 2. Dessin technique

### 2.1 Clé = texte français
La clé du dictionnaire est **le texte français lui-même**. Pas de slug à
inventer, pas de risque de dérive d'inventaire. Exemple :

```js
export const LANGUES = {
  fr: { nom: 'Français', textes: {} },            // fr = source : identité
  de: { nom: 'Deutsch', textes: { 'Bonnes promos': 'Gute Angebote', … } },
};
export const t = (texte, langue) => (LANGUES[langue]?.textes[texte]) || texte;
```

Conséquence assumée : si le texte français change, la traduction retombe
silencieusement en français. **C'est pour cela qu'un test d'inventaire est
obligatoire** (voir 4) : il échoue bruyamment si une clé existe en `fr` mais
manque ailleurs.

### 2.2 Traduction par parcours du DOM
Plutôt que d'envelopper chaque chaîne de `app.js` dans un `t()` (des centaines
d'endroits, dont des gabarits), on **traduit après rendu** :

- un `MutationObserver` (ou un appel après chaque rendu) parcourt le DOM ;
- pour chaque **nœud texte** et chaque attribut porteur de texte
  (`title`, `placeholder`, `aria-label`), si le contenu *rogné* est une clé du
  dictionnaire, on le remplace ;
- les nœuds déjà traduits sont marqués (`data-t9n`) pour ne pas être retouchés ;
- quand la langue est `fr`, **le parcours ne fait rien** (aucun coût, aucune
  régression possible).

Avantage : `index.html` n'est **pas** modifié (zéro `data-i18n` à poser), et
tout le contenu dynamique est couvert automatiquement.

### 2.3 Fichiers
- **`public/langues.js`** (nouveau) — module ES : `LANGUES`, `t`, `LANGUE_DEFAUT`,
  `LANGUES_OFFERTES` (liste ordonnée), `navigateurLangue()`.
- **`public/app.js`** — importer `langues.js`, ajouter une rubrique « Langue »
  dans la feuille Réglages, mémoriser dans `localStorage['promos.langue']`,
  poser `document.documentElement.lang`, lancer le parcours après chaque rendu.
- `docs/` est une **copie** de `public/` (le collecteur copie à chaque passage) :
  ne rien éditer dans `docs/` à la main.

## 3. Unités de travail (une par passage, dans cet ordre)

Chaque passage : travailler, **exécuter `bash bin/tester.sh`**, commiter, mettre
à jour la ligne d'avancement en bas de ce fichier. Ne jamais avancer si les
tests sont rouges.

1. `public/langues.js` + moteur (2.1, 2.2, 2.3) avec **fr seul**. Aucun
   changement visible : le site doit rester exactement en français.
2. Sélecteur de langue dans Réglages + `localStorage` + `document.documentElement.lang`.
3. Tests d'inventaire (section 4) — ils doivent échouer au début (langues
   manquantes), c'est normal.
4. `nl` — **la Belgique doit avoir français ET néerlandais** : c'est la priorité 1.
5. `de`  6. `en`  7. `es`  8. `it`  9. `pt`  10. `pl`  11. `sv`
12. Mesure honnête : compter, par langue, les textes **restés en français** ;
    citer les 5 premiers de chaque langue. Relire `langues.js` pour supprimer
    les oublis.
13. Publication : `bash bin/collecter.sh` (met `docs/` à jour et pousse sur GitHub).
14. APK : `cd /opt/data/android-build && bash preparer-promos.sh && bash compiler-promos.sh && bash signer-promos.sh`,
    puis `node /opt/data/webdev/projects/promos/outils/verifier-apk.mjs`.
    Copier en `promos-2026-10-07-langues.apk`, calculer le SHA-256, **vérifier
    que la signature reste `f15debc…`**.
15. Rapport à B (en français, court) : ce qui est fait, la mesure, les manques
    cités, l'APK livré.

## 4. Exigences de vérification — non négociables

- **Parité d'inventaire** : pour chaque langue, l'ensemble des clés doit être
  **exactement** celui de `fr` (ni manquante, ni en trop).
- **Mesure de reste** : pour chaque langue, compter les textes affichés encore
  identiques au français ; lister les exceptions légitimes (noms propres :
  « Promos », « Amazon », « Dealabs »…). **Ne jamais annoncer un chiffre sans
  pouvoir le prouver.**
- **Contrôle visuel** : `PLAYWRIGHT_BROWSERS_PATH=/opt/data/capture/browsers`,
  ouvrir la page avec `?lang=de` (ou via `localStorage`) et vérifier qu'aucun
  libellé français ne subsiste dans l'en-tête, les puces, la feuille Réglages.
- Le choix de langue doit être **indépendant du pays** : basculer le pays ne doit
  pas changer la langue, et inversement. Le tester.
- Ne jamais annoncer « c'est fini » sans avoir exercé l'artefact.

## 5. Avancement

| # | Unité | État |
|---|-------|------|
| 1 | Moteur + `fr` | à faire |
| 2 | Sélecteur de langue | à faire |
| 3 | Tests d'inventaire | à faire |
| 4 | `nl` | à faire |
| 5 | `de` | à faire |
| 6 | `en` | à faire |
| 7 | `es` | à faire |
| 8 | `it` | à faire |
| 9 | `pt` | à faire |
| 10 | `pl` | à faire |
| 11 | `sv` | à faire |
| 12 | Mesure honnête | à faire |
| 13 | Publication | à faire |
| 14 | APK + vérification | à faire |
| 15 | Rapport | à faire |
