# Fiche administrative — ce qui reste à fournir

Relevé du **8 octobre 2026**. Demande de B : « Il faut aussi faire toute la partie administrative
pour officialiser le site. »

Ce document est le **point de passage unique** : tout ce que je ne peux pas savoir de vous y est
listé, champ par champ. Il n'y a rien à décider ailleurs.

**Règle appliquée partout : rien n'a été inventé.** Là où je ne sais pas, j'ai écrit un champ à
compléter — jamais une valeur plausible. Un numéro d'entreprise inventé serait plus grave qu'un
champ vide, parce qu'il aurait l'air vrai.

---

## A. Les quatre pages, ce qu'elles sont

Créées le 08/10/2026 (elles répondaient toutes 404 avant) :

| Page | Adresses | Rôle |
|---|---|---|
| Mentions légales | `mentions-legales` + `.nl` + `.en` | Qui édite, qui héberge, propriété, affiliation, litiges |
| Politique de confidentialité | `confidentialite` + `.nl` + `.en` | RGPD : ce qui est traité, où, combien de temps, vos droits |
| Cookies et stockage local | `cookies` + `.nl` + `.en` | Pourquoi il n'y a **pas** de bannière |
| Conditions d'utilisation | `cgu` + `.nl` + `.en` | Ce que le site garantit — et ne garantit pas |

Toutes à `kazendra.com/`, en `.html`. Plus, hors pages : `robots.txt` et `sitemap.xml` (eux aussi en
404 avant), et les liens vers les quatre pages dans le **pied de page** du site.

**Les douze pages existent en trois langues** — français, néerlandais, anglais (décision de B du
08/10/2026). Chaque page porte un **sélecteur de langue** et déclare ses traductions aux moteurs de
recherche (`hreflang`). Le **pied de page du site suit la langue choisie** : les six autres langues de
l'interface (de, es, it, pt, pl, sv) mènent à l'anglais, comme les liens sortants.

Les trois versions ont **exactement la même structure** — même nombre de sections, mêmes rubriques
obligatoires. Une épreuve refuse qu'une section disparaisse d'une seule langue : ce serait un manque
invisible, la page ayant toujours l'air complète.

**En cas de divergence d'interprétation, la version française fait foi** : c'est celle dans laquelle
les textes ont été rédigés, et les trois pages le disent en toutes lettres.

---

## B. À REMPLIR — l'identité de l'éditeur

Ces valeurs apparaissent dans `mentions-legales.html` et `confidentialite.html`, aux endroits
surlignés en jaune. **Une seule saisie**, recopiée aux deux endroits.

| Champ | Valeur |
|---|---|
| Nom et prénom |  |
| Forme juridique | ✅ **personne physique** — tranché le 08/10/2026 |
| Adresse géographique (rue, code postal, commune, pays) |  |
| Numéro d'entreprise (BCE) — format `0xxx.xxx.xxx` |  |
| Régime de TVA | ✅ **non assujetti** — franchise de la petite entreprise, tranché le 08/10/2026 |
| Adresse e-mail de contact **professionnelle** |  |
| Téléphone |  |
| Responsable de la publication (nom) |  |
| Marque « Kazendra » : déposée ? si oui, numéro et date |  |

⚠️ **Pourquoi l'adresse et le téléphone sont obligatoires** : la loi belge du 11 mars 2003 et
l'article VI.5 du Code de droit économique exigent que l'éditeur d'un service en ligne soit
identifiable **et joignable**. Un formulaire de contact ne suffit pas.

---

## C. ✅ DÉCISION N° 1 — TRANCHÉE le 08/10/2026

**Réponse de B** : « Pour l'instant ça va être un régime fiscal de petite entreprise en personne
physique. »

**Ce qui a été appliqué dans les pages, tout de suite :**

- **Forme juridique = personne physique** exerçant une activité indépendante. Les mentions légales ne
  parlent plus de « raison sociale » ni de société : un nom et un prénom.
- **Régime de TVA = franchise de la petite entreprise** → **non assujetti**. C'est écrit noir sur blanc
  dans les mentions légales (§ 1), avec la conséquence : le site est gratuit, donc aucune opération
  soumise à la TVA n'y est réalisée envers ses visiteurs.

**Ce que ce choix ne dispense PAS de faire :**

**Le numéro d'entreprise (BCE) reste obligatoire.** La franchise de la petite entreprise dispense de la
**TVA**, pas de l'**immatriculation** : une activité commerciale exercée en personne physique doit être
inscrite à la BCE pour obtenir son numéro. Tant qu'il manque, les mentions légales restent incomplètes —
c'est le dernier champ bloquant de la page.

**Ce qu'il reste à faire de votre côté, dans cet ordre :**

1. **S'inscrire à la BCE** via un guichet d'entreprises (la démarche se fait en ligne pour la plupart)
   → vous recevez un **numéro d'entreprise**.
2. Reporter dans le tableau du § B : ce numéro, **votre adresse**, un **e-mail professionnel** et un
   **téléphone**.
3. Me le dire : je retire le bandeau « page non définitive » et les surlignages dans la même passe.

⚠️ **Un point à regarder en face.** La mention légale exige une **adresse géographique**. Pour une
personne physique sans local d'exploitation, c'est en pratique **l'adresse du domicile** qui se retrouve
publiée. Si cela vous gêne, il existe des solutions (domiciliation de l'activité, adresse de
contact) — elles ont un coût et ne dispensent pas toujours de la mention. C'est votre décision ; je ne
l'anticipe pas, et je n'écrirai aucune adresse avant que vous me la donniez.

---

## D. ✅ DÉCISION N° 2 — TRANCHÉE le 08/10/2026

**Réponse de B** : « Tu peux faire la traduction en anglais et en néerlandais. »

**Fait et publié** : les quatre pages existent maintenant en **français, néerlandais et anglais** —
douze documents. Chacune a son sélecteur de langue, et le pied de page du site s'adapte à la langue
choisie.

**Choix retenu pour les autres langues** : les six langues restantes de l'interface (allemand,
espagnol, italien, portugais, polonais, suédois) mènent à la **version anglaise**. C'est la règle de
repli déjà appliquée aux liens sortants : une page légale en anglais vaut mieux qu'une page légale
dans une langue qu'on n'a pas — et surtout mieux qu'un intitulé traduit vers une page inexistante.

**Ce que ça change pour la suite** : toute correction d'une page légale devra désormais être faite
**trois fois**. C'est le coût d'une traduction, et il est assumé. Les trois versions ont la même
structure, et une épreuve le vérifie : c'est ce qui empêche une correction d'être appliquée à une
seule langue et oubliée dans les deux autres.

---

## E. DÉMARCHES QUI VOUS APPARTIENNENT (je prépare, vous signez)

| Démarche | Ce qu'il faut de vous | Où c'est décrit |
|---|---|---|
| **Dépôt de marque « Kazendra »** (BOIP, Benelux) | Votre identité + un paiement | Plan, § 2 |
| **Amazon Partenaires**, puis Awin et TradeTracker | Votre identité + un **IBAN** | Plan, § 4 |
| **Redirections OVH** `.be` `.fr` `.eu` `.app` → `.com` | ~10 min dans votre compte OVH | Plan, § 3 |

Je ne peux ni déposer une marque, ni signer un contrat, ni engager un paiement à votre place. Un
dépôt fait au mauvais nom serait pire que pas de dépôt du tout.

---

## F. Points d'exactitude à ne pas oublier

1. **Hébergement.** Les pages nomment **GitHub, Inc.** (GitHub Pages) comme hébergeur, et **OVH SAS**
   pour les noms de domaine. Ces informations sont publiques, mais elles doivent être **relues au
   moment de la publication** : si l'hébergement change, la mention doit changer avec lui.
   Un emplacement est prévu dans `confidentialite.html` (§ 6) pour la référence de clause
   contractuelle, à remplacer par celle du contrat réellement en vigueur.

2. **Affiliation.** Les pages disent aujourd'hui, honnêtement : « aucun identifiant d'affiliation
   n'est posé, les liens sont directs et aucune commission n'est perçue ». **Cette phrase doit
   disparaître le jour où les identifiants sont posés — pas avant.** Trois pages la portent :
   mentions légales § 5, CGU § 5, et la mention du pied de page du site.

3. **Formulaire d'inscription.** Les pages disent qu'il **n'envoie rien** aujourd'hui : c'est vrai,
   `URL_TABLEAU` est vide dans `public/inscription.js`. La politique de confidentialité devra être
   mise à jour **avant** de le brancher, pour nommer le destinataire exact et la durée de
   conservation.

4. **Plateforme RLL.** La plateforme européenne de règlement en ligne des litiges a cessé son
   activité ; elle n'est volontairement **pas** citée, contrairement à ce que reprennent encore
   beaucoup de modèles de mentions légales en circulation.

---

## G. Ce qui est protégé automatiquement

Pour mémoire, ces épreuves surveillent la partie administrative et **échouent** si elle se dégrade :

```
tests/legal.test.mjs — 13 épreuves
  • les 4 pages existent, sont atteignables depuis le pied de page
  • aucune n'appelle de feuille de style EXTERNE (elles restent lisibles
    même quand le PC de B coupe les .css)
  • chaque page porte les rubriques exigées (éditeur, BCE, hébergeur, RGPD,
    droits, APD, cookies, « le site n'est pas le vendeur »)
  • RIEN N'EST INVENTÉ : un numéro BCE ou une adresse e-mail hors des champs
    « à compléter » fait ÉCHOUER la suite
  • robots.txt interdit /admin/ et déclare le plan du site
  • sitemap.xml ne liste QUE des pages qui existent réellement
```
