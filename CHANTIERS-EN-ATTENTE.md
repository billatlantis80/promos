# Chantiers mis de côté

Ce qui a été constaté, chiffré, et volontairement pas traité. Chaque ligne porte sa
mesure et la date de la décision, pour qu'on puisse reprendre le fil sans rechercher
dans une conversation.

## Les vignettes grises — reporté le 14/10/2026 (« plus tard, c'est minime »)

**16 cartes affichées** montrent une vignette grise au lieu d'un visuel.

La cause est mesurée : **9 fichiers de `docs/img/` ne sont pas des images**. Le marchand
renvoie un SVG de remplacement — un rectangle gris sans contenu — quand il n'a pas de
visuel pour l'article, et le collecteur l'a enregistré sous l'extension `.jpg`. Le
catalogue publie ces fichiers comme s'ils étaient des photos.

Répartition par source, au 14/10/2026 :

| source | cartes affichées |
|---|---|
| Pepper NL | 5 |
| Preisjäger | 5 |
| Pepper PL | 5 |
| MyDealz | 1 |

10 fiches périmées portent aussi un de ces fichiers : elles repartiront avec la même
vignette grise si leur source les ressert.

**Ce qu'il faudrait faire** : au moment de rapatrier un visuel, reconnaître qu'un fichier
dont le contenu commence par `<svg` n'est pas une image, et traiter la carte comme une
fiche sans visuel (repli générique) plutôt que d'enregistrer le fichier. Les 9 fichiers
déjà en stock seraient à retirer du catalogue, et leurs cartes basculées sur le repli.
