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

| Page | Adresse | Rôle |
|---|---|---|
| Mentions légales | `kazendra.com/mentions-legales.html` | Qui édite, qui héberge, propriété, affiliation, litiges |
| Politique de confidentialité | `kazendra.com/confidentialite.html` | RGPD : ce qui est traité, où, combien de temps, vos droits |
| Cookies et stockage local | `kazendra.com/cookies.html` | Pourquoi il n'y a **pas** de bannière |
| Conditions d'utilisation | `kazendra.com/cgu.html` | Ce que le site garantit — et ne garantit pas |

Plus, hors pages : `robots.txt` et `sitemap.xml` (eux aussi en 404 avant), et les liens vers les
quatre pages dans le **pied de page** du site.

**Ces pages sont en français seulement.** Le site, lui, est traduit. Un intitulé traduit vers une page
qui n'existe pas dans cette langue serait un mensonge : les liens du pied de page restent donc en
français. Les versions **néerlandaise et anglaise** restent à produire (voir § C).

---

## B. À REMPLIR — l'identité de l'éditeur

Ces valeurs apparaissent dans `mentions-legales.html` et `confidentialite.html`, aux endroits
surlignés en jaune. **Une seule saisie**, recopiée aux deux endroits.

| Champ | Valeur |
|---|---|
| Nom ou raison sociale |  |
| Forme juridique (personne physique, SRL, SNC, ASBL…) |  |
| Adresse du siège (rue, code postal, commune, pays) |  |
| Numéro d'entreprise (BCE) — format `0xxx.xxx.xxx` |  |
| Numéro de TVA (ou « non assujetti » si franchise) |  |
| Adresse e-mail de contact **professionnelle** |  |
| Téléphone |  |
| Responsable de la publication (nom) |  |
| Marque « Kazendra » : déposée ? si oui, numéro et date |  |

⚠️ **Pourquoi l'adresse et le téléphone sont obligatoires** : la loi belge du 11 mars 2003 et
l'article VI.5 du Code de droit économique exigent que l'éditeur d'un service en ligne soit
identifiable **et joignable**. Un formulaire de contact ne suffit pas.

---

## C. DÉCISION N° 1 — l'activité est-elle commerciale ?

C'est **la** question qui change le reste. Elle a deux issues, et une seule vous appartient :

**Si le site doit un jour percevoir des commissions d'affiliation** (Amazon Partenaires, Awin,
TradeTracker… — voir § 4 du plan), l'activité est commerciale en Belgique. Il faut alors :

1. **S'inscrire à la BCE** (Banque-Carrefour des Entreprises) via un guichet d'entreprises →
   obtention d'un **numéro d'entreprise** ;
2. **S'identifier à la TVA** — avec, si le chiffre d'affaires reste sous les seuils, le régime de
   **franchise de la petite entreprise** (dispense de TVA, mention « non assujetti » sur les
   factures) ;
3. Mentionner le numéro d'entreprise sur le site (c'est le champ du § B).

**Si le site reste entièrement gratuit et sans aucune rémunération**, l'obligation d'immatriculation
ne se pose pas de la même façon — mais une **activité commerciale non déclarée** reste un risque
(redressement, amendes). Je ne peux pas trancher à votre place : c'est une décision fiscale.

**Ce que je peux faire, moi** : préparer les mentions dans la forme « personne physique » **ou** dans
la forme « société », et basculer d'une forme à l'autre dès que vous avez tranché.

---

## D. DÉCISION N° 2 — les langues des pages légales

Le site est offert en plusieurs langues ; les pages légales ne le sont qu'en français aujourd'hui.

- **Option A (Belgique d'abord)** : produire le **néerlandais** en plus du français. C'est le minimum
  pour un site belge qui s'adresse aussi à la Flandre.
- **Option B (Europe)** : français + néerlandais + anglais, et l'anglais sert de repli pour les
  11 autres pays.

Les deux sont possibles. L'option B demande plus de texte à écrire et à tenir à jour (chaque
correction future devra être faite dans chaque langue).

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
