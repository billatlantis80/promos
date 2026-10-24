# `/annonce` — spécification détaillée

Première porte construite. C'est aussi le **moteur A** réutilisé par `/immo`, `/evenement` et
`/rencontre` : ce qui est décidé ici servira trois fois.

## 1. Objet

Vendre, donner, échanger, louer du matériel entre particuliers. Les boutiques peuvent publier
en payant. Aucun paiement entre acheteur et vendeur ne passe par la plateforme.

## 2. Écrans

1. **Liste** — recherche, filtres, tri, résultats en cartes. Carte géographique en option,
   jamais imposée (elle coûte du poids sur mobile).
2. **Détail** — photos, prix, état, description, commune, contact, signaler, favori.
3. **Dépôt** — quatre étapes : photos → description et prix → lieu → publication (et paiement
   si compte entreprise).
4. **Mes annonces** — gérer : modifier, renouveler, marquer vendu, supprimer, voir les vues.
5. **Messages** — boîte commune au hub, pas une messagerie par porte.

## 3. Champs d'une annonce

- **titre** — 70 caractères maximum
- **catégorie / sous-catégorie** — liste fermée, jamais de saisie libre
- **type d'offre** — vente · don · location · **échange**
- **état** — neuf · comme neuf · bon état · usagé · pour pièces
- **prix** — montant dans la devise du pays, ou « gratuit »
- **location** — prix par jour, en plus du prix de vente
- **description** — 2 000 caractères maximum
- **photos** — 1 à 6, la première sert de vignette
- **lieu** — code postal et commune choisis dans une liste, **jamais une adresse tapée**
- **contact** — **messagerie uniquement** : aucun numéro de téléphone n'est affiché dans une
  annonce, même si l'auteur le propose. Le numéro reste collecté pour la vérification du compte
  et n'apparaît nulle part publiquement.
- **options** — prix négociable, remise en main propre, envoi possible
- **durée** — 30 jours, renouvelable

**Ne figurent jamais dans une annonce** : adresse exacte, nom de famille, IBAN, adresse e-mail.

## 4. Filtres de la liste

Catégorie, type d'offre, état, prix minimum et maximum, distance (à partir du code postal de
l'utilisateur : 5 / 10 / 25 / 50 km), tri (les plus récentes, prix croissant, prix décroissant).
Le filtre « à donner » est un filtre de premier niveau, parce que c'est un des usages les plus
demandés et qu'il ne doit pas être enterré.

## 5. États d'une annonce

`brouillon` → `attente_paiement` (entreprise seulement) → `publiée` → puis, au choix :
`masquée` (trois signalements, en attente de décision) · `retirée` (modération) · `vendue` ·
`expirée` → `archive` (30 jours de récupération) → **supprimée**.

Chaque passage d'état écrit **qui, quand, pourquoi**. Une annonce ne saute jamais d'état en
silence : sans ça, un vendeur ne comprend pas pourquoi son annonce a disparu.

## 6. Parcours particulier

Compte (e-mail + téléphone vérifiés) → dépôt → **publication immédiate** → contrôle sous 24 h →
30 jours en ligne → rappels J−7 et J−2 → expiration → 30 jours de récupération → suppression.
Quota : **5 annonces actives** en même temps. Renouvellement libre.

## 7. Parcours entreprise

Compte entreprise (numéro BCE vérifié en local) → dépôt → **paiement 5 € HTVA** → publication
dès le webhook de paiement → facture émise → contrôle sous 24 h.
Si l'annonce est retirée pour non-respect des règles : **remboursement des trois quarts**, une
note de crédit, et le tout écrit dans les conditions avant le paiement.
Tant que le numéro d'entreprise n'existe pas : mode test, activation manuelle, **aucun euro
réel encaissé**.

## 8. Contact et messages

- Messagerie **uniquement** : aucun numéro de téléphone n'apparaît sur une annonce (choix de
  l'utilisateur le 23/10/2026). Le numéro sert à vérifier le compte, jamais à être publié.
  C'est le seul contact possible : pas de scraping, pas d'appel surprise, et une trace écrite
  en cas de litige.
- Notification par e-mail à chaque nouveau message. Pas de messagerie temps réel en V1 : c'est
  un chantier à part, et il n'est pas nécessaire pour vendre un vélo.
- Un message peut être signalé sans signaler l'annonce.

## 9. Anti-abus

- 5 annonces actives par particulier ; limite de publication par jour
- un téléphone vérifié = un compte
- détection de doublons (même titre, même prix, mêmes photos) → mise en attente
- blocage d'un utilisateur par un autre, sans justification à fournir
- toute annonce masquée ou retirée reste consultable par la modération, jamais par le public

## 10. Ce que `/annonce` ne fait pas

Pas de paiement entre acheteur et vendeur, pas d'expédition, pas de garantie, pas d'enchères,
pas de notation des vendeurs en V1. Chaque refus est écrit dans les conditions : ce qu'on ne
promet pas, on ne le laisse pas croire.

## 11. Référencement et poids

Une page par annonce, adresse stable (`/annonce/<identifiant>-<titre>`), titre et description
propres, données structurées, plan de site mis à jour à chaque publication. Photos servies en
plusieurs tailles, chargement différé, page qui reste utilisable en connexion lente.

## 12. Liste fermée des catégories (validée le 23/10/2026)

Onze catégories de premier niveau, chacune avec trois à cinq sous-catégories. Aucune saisie
libre : sans liste fermée, la recherche se remplit de doublons et le référencement devient
impossible.

1. **Maison & mobilier** — meubles · décoration · électroménager · vaisselle
2. **Électronique** — téléphones · ordinateurs · TV et audio · consoles et jeux vidéo · photo
3. **Mode & accessoires** — vêtements · chaussures · sacs · bijoux
4. **Enfants & bébé** — puériculture · jouets · vêtements d'enfant
5. **Sport & plein air** — vélos · fitness · camping · sports d'hiver
6. **Véhicules** — voitures · deux-roues · pièces et pneus · remorques · caravanes et camping-cars · bateaux
7. **Jardin & bricolage** — outillage · jardin · piscine et terrasse
8. **Culture & loisirs** — livres · musique et instruments · jeux de société · collections
9. **Animaux** — adoption · accessoires · matériel
10. **Matériel professionnel** — outillage · bureau · horeca · viticole · matériel agricole et équestre
11. **Divers** — y compris matériel médical et mobilité

### Ce qui manque vraiment — **les quatre points sont adoptés le 23/10/2026**

Compléter une liste de catégories est un piège : chaque rayon ajouté est un rayon à remplir.
Ce qui manquait, ce n'était donc pas dix catégories de plus, c'était quatre choses précises.

**1. ✅ Un quatrième type d'offre : « Échange ».** Le troc existe partout et n'entre ni dans
« vente », ni dans « don », ni dans « location ». Types : vente · don · location · échange.

**2. ✅ Cinq sous-catégories qui manquaient** (toutes intégrées à la liste ci-dessus) :
- dans **Véhicules** : caravanes et camping-cars · bateaux
- dans **Matériel professionnel** : matériel agricole et équestre
- dans **Électronique** : jeux vidéo (explicite, sinon il se noie dans « ordinateurs »)
- dans **Divers** : matériel médical et mobilité (fauteuils, déambulateurs) — un vrai besoin
  d'occasion, socialement utile, et qui ne trouve sa place nulle part ailleurs

**3. La liste des objets interdits** — c'est elle qui protège la plateforme, bien plus qu'une
catégorie. Rien ne se publie pour : armes et munitions · drogues · médicaments · contrefaçons ·
espèces animales protégées · données personnelles (listes, comptes, fichiers) · denrées
alimentaires · tabac et alcool · billets de spectacle et de transport (revente frauduleuse).
Animaux : **adoption seulement**, pas de vente d'animaux entre particuliers — la vente est
encadrée (identification, agréments), et c'est un terrain à ne pas ouvrir sans cadre.

**4. Un thermomètre pour « Divers ».** Si plus d'une annonce sur cinq atterrit dans « Divers »,
c'est qu'une catégorie manque : on la crée à ce moment-là, avec les mots réellement employés
par les gens, pas avec ceux qu'on a imaginés. La liste s'améliore par la mesure, pas par
l'intuition.

**Écarté volontairement** : billetterie (revente frauduleuse, prix gonflés) · produits
alimentaires et cosmétiques (sécurité, traçabilité) · cours et formations (ils vivent dans
`/job-etudiant`) · colocation et location de vacances (ils vivent dans `/immo`).



**Règles qui vont avec :**

- **Le type d'offre n'est pas une catégorie** — vente, don, location et échange sont quatre
  types, pas quatre rayons. Mélanger les deux casse les filtres et l'indexation.
- Chaque catégorie porte un **identifiant stable** (`maison`, `electro`, `vehicules`…) ; le
  libellé affiché est une traduction. On ne stocke jamais le mot affiché : sinon renommer une
  catégorie casse les adresses et le référencement.
- **Une catégorie vide ne s'affiche pas** sur la liste publique tant qu'elle n'a rien dedans —
  même principe que les portes : on n'ouvre pas un rayon vide au visiteur.
- Une catégorie n'est créée que si elle peut tenir une trentaine d'annonces réelles dans les
  premiers mois. Sinon elle attend.
- Les champs propres à une catégorie (année et kilométrage pour un véhicule, taille pour un
  vêtement) s'ajoutent **après** la V1, catégorie par catégorie, en commençant par celles qui
  ont du volume.
- « Objets trouvés » n'ouvre pas de catégorie en V1 : le volume ne le justifie pas, et la
  mécanique est différente (perdu / trouvé).


## 13. Cas limites à traiter dès la première version

- annonce expirée consultée → page « expirée » avec annonces proches, jamais une page vide
- annonce retirée par la modération → page qui explique le retrait, sans détail humiliant
- vendeur qui supprime son compte → annonces retirées, messages conservés le temps légal
- photo refusée (format, poids) → message clair, pas une erreur technique
- prix à 0 → devient « gratuit », pas un prix nul
- annonce dans un pays hors zone euro → devise du pays, jamais un eurosymbole trompeur

## 14. Objets interdits (validé le 23/10/2026)

Rien ne se publie pour : **armes et munitions · drogues · médicaments · contrefaçons · espèces
animales protégées · données personnelles** (listes, comptes, fichiers) **· denrées
alimentaires · tabac et alcool · billets de spectacle et de transport**.

**Animaux : adoption seulement.** Pas de vente d'animaux entre particuliers — la vente est
encadrée (identification, agréments) et c'est un terrain à ne pas ouvrir sans cadre.

Cette liste s'affiche dans le formulaire de dépôt, pas seulement dans les conditions : un
vendeur doit savoir avant de rédiger son annonce, pas après son retrait.
