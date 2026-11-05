# Réécriture de l'historique du dépôt — décision de B, 14 octobre 2026

## La décision

**Option C : dépôt neuf.** L'historique git a été remplacé par un commit racine unique
portant l'état exact du site publié. Les 2 701 commits et les 4 tags d'avant ont été
retirés de la branche.

Choix posé par B après que les deux options ont été chiffrées :

- **Option A** — ne rien faire : le `.git` ne comptait pas dans le quota Pages, mais il
  pesait 3,2 Go et grossissait d'environ 160 Mo par jour.
- **Option B** — réécriture par filtre : mesurée sur un clone jetable, elle ramenait le
  dépôt à 695 Mo **en conservant** les 2 690 commits et les 4 tags.
- **Option C** — commit racine unique : ~660 Mo, mais **2 701 commits et 4 tags perdus**.

B a tranché pour C le 14/10/2026 après avoir lu les 4 tags en détail et la répartition
des 161 commits de décision.

## Ce qui a été fait, dans l'ordre

1. Collecte mise en pause (tâche planifiée) et secours GitHub Actions **désactivé** —
   sans quoi l'un des deux aurait repoussé l'ancienne histoire après le force-push.
2. **Sauvegarde complète** de l'histoire d'avant :
   `/opt/data/sauvegardes/promos-historique-avant-C-2026-10-14.bundle`
   — 2,97 Go, 2 701 commits, les 4 tags. Vérifiée (`records a complete history`).
3. Commit racine créé : `b45a4376b`, **39 367 fichiers**, une seule différence avec
   l'état publié (`donnees/verdicts-sources.json`, la collecte du matin).
4. Force-push sur `main`.
5. Les 4 tags supprimés, côté distant et en local.
6. Nettoyage local : `git reflog expire --expire=now --all && git gc --prune=now`.
7. Collecte et secours GitHub réactivés, puis **un passage de collecte complet** lancé
   pour vérifier la chaîne de bout en bout : collecte → entretien des visuels → commit →
   push. Code de sortie 0.

## Les mesures, avant et après

| | avant | après |
|---|---|---|
| `.git` local | 3 200 Mo | **617 Mo** |
| dépôt côté GitHub | 2 922 Mo | **595 Mo** |
| commits | 2 701 | **1** (+ les collectes qui suivent) |
| tags | 4 | **0** |

Le ramasse-miettes de GitHub est passé de lui-même **en moins de dix minutes** après le
force-push : aucune démarche auprès du support n'a été nécessaire.

## Restaurer l'ancienne histoire

```bash
git clone /opt/data/sauvegardes/promos-historique-avant-C-2026-10-14.bundle promos-avant
```

Le bundle contient tout : les 2 701 commits, les 4 tags, l'arbre complet à chaque étape.

## Ce qui a été vérifié avant de supprimer

Rien d'unique et d'utile ne vivait uniquement dans cet historique :

- **Les 20 fichiers source du logo** ont été extraits au préalable. Après tri, **un seul a
  été gardé** : `kazendra-icone-1024.png` — les pixels de B, byte pour byte identiques à
  ceux du dépôt, et dont le favicon en ligne est la réduction exacte au quart.
  Il est conservé dans `/opt/data/kazendra-sources-identite/`.
- Le seul autre candidat, `kazendra-vecteur-4096.png` (tracé vectoriel haute résolution
  pour l'impression), a été **écarté par B pour un défaut visuel** : une couture visible
  entre deux des 6 pièces du tracé, à l'endroit où le orange est coupé par un liseré blanc.
- Sur 151 fichiers retirés de l'arbre, **130 étaient déjà archivés** dans
  `/opt/data/sauvegardes` (dont les 124 outils de diagnostic, dans
  `promos-superflu-2026-10-11.tar.gz`).

## Ce que la réécriture a coûté

La traçabilité : le lien entre une ligne de code et la décision qui l'a motivée. Avant,
`git log` répondait « pourquoi ce `if` ». Les plans (`PLAN-*.md`, `AUDIT-*.md`) survivent,
car ils vivent dans l'arbre — c'est `git log` seul qui ne peut plus raconter l'histoire.

Le document `kazendra-161-commits.md` (hors dépôt) conserve la liste des 161 commits de
décision et des 4 tags, pour mémoire.
