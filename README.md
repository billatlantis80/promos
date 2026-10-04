# Promos — application n°2

Toutes les bonnes offres au même endroit, rassemblées depuis des flux publics
(**aucune clé d'API, aucun compte**) : Dealabs, presse spécialisée « bons
plans », et Google News.

## Comment ça marche

- `collecteur.mjs` interroge les sources, normalise les offres, et écrit l'état.
- `docs/` est le **site publié** : l'interface et les offres, avec leurs visuels
  téléchargés sur place. C'est ce dossier que GitHub Pages sert.
- `.github/workflows/collecte.yml` relance la collecte toutes les 5 minutes.
- `server.js` sert le site en local (et relaie les visuels distants) pour le
  WebDev Hub.

## Règles tenues par le code

- **Aucune clé, aucun compte.** Uniquement des flux publics.
- **Aucune remise inventée.** Un pourcentage n'est affiché que s'il est écrit
  dans la source, ou calculé entre deux prix réellement présents.
- **Dealabs : uniquement les meilleures.** Un seul flux, `tendance`, celui que
  la communauté classe par température — et il n'est interrogé qu'une fois
  toutes les 15 minutes pour ne pas marteler le site.
- **Les visuels sont rapatriés**, jamais liés directement : la politique
  d'origine croisée des sources les ferait refuser par le navigateur.

## Lancer à la main

```bash
node collecteur.mjs              # met à jour data/offres.json (usage local)
node collecteur.mjs --publier    # met à jour docs/ (site prêt à publier)
node collecteur.mjs --verbeux    # détail de chaque source
node --test                      # tests
```

## Ce qui reste à la charge du propriétaire

- Créer les comptes d'affiliation (Amazon Partenaires, Awin…) et coller les
  identifiants dans `docs/affiliation.js` — sans eux, les liens sortent en
  direct, sans commission.
