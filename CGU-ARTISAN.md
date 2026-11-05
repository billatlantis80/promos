# CGU — clause de la porte `/artisan`

**25 octobre 2026.** Texte prêt à insérer dans `public/cgu.html`, en **article « 2 ter »**, juste après la
clause « 2 bis — Les offres d'emploi ». Même registre que les onze articles existants (phrases courtes,
présent, « Kazendra » à la troisième personne).

## Le texte à insérer

> **2 ter. Les artisans et services à domicile**
>
> La porte « artisans » publie des fiches de professionnels et permet de les joindre. Kazendra n'est ni
> l'employeur, ni le maître d'œuvre, ni partie au contrat conclu entre le professionnel et son client. Il
> n'encadre aucun chantier, ne reçoit aucun paiement et ne conserve aucune demande de devis.
>
> Chaque fiche affiche ce que le professionnel déclare : ses métiers, sa zone d'intervention, ses
> horaires, son assurance et, le cas échéant, son attestation d'accès à la profession. Kazendra vérifie le
> numéro d'entreprise à la main et affiche la date de cette vérification. Il ne vérifie ni l'assurance, ni
> l'attestation, ni la compétence, ni la qualité du travail, ni le prix. Aucune mention de la fiche ne
> constitue une garantie.
>
> Les photos de réalisations sont publiées sous la responsabilité du professionnel, qui déclare disposer
> de l'accord des personnes dont le logement est photographié. Aucune photo montrant une personne
> identifiable n'est acceptée. Toute personne peut demander le retrait d'une photo la concernant ; il est
> effectué sans condition.
>
> L'image qui identifie l'entreprise — son logo ou, à défaut, une photo de son entreprise — est publiée
> sous sa responsabilité : le professionnel déclare qu'elle lui appartient et qu'il en détient les
> droits. Elle ne peut montrer aucune personne identifiable sans son accord, ni le numéro de rue d'un
> logement privé. Les métadonnées du fichier, y compris les coordonnées de localisation qu'il peut
> contenir, sont effacées avant publication. L'image ne remplace ni le nom, ni le numéro d'entreprise, et
> sa présence ne constitue aucune vérification. Toute personne peut en demander le retrait ; il est
> effectué sans condition.
>
> Le numéro de téléphone affiché est un numéro professionnel, publié avec l'accord du professionnel et
> pendant la durée de sa fiche. Un numéro personnel de salarié n'est pas accepté. Le numéro et la fiche
> sont supprimés à l'échéance, et le retrait peut être demandé à tout moment.
>
> La demande de devis ne transite pas par Kazendra : elle est rédigée et envoyée depuis la messagerie du
> visiteur, qui peut joindre ses photos dans son courriel. Kazendra ne reçoit, ne lit et ne conserve
> aucune demande, et ne peut donc en confirmer ni la réception ni la suite.
>
> Aucun avis, aucune note et aucun classement ne sont publiés sur cette porte. Aucun professionnel ne peut
> acheter un meilleur rang : l'ordre de l'annuaire est alphabétique ou chronologique, et une fiche mise en
> avant porte la mention « fiche sponsorisée ».
>
> La fiche est payante pour le professionnel — 79 € HTVA pour 365 jours, une seule facture, sans
> abonnement ni renouvellement automatique. Elle est gratuite pour le particulier, qui ne paie rien pour
> chercher, appeler ou demander un devis.

## Ce que chaque paragraphe ferme

| Paragraphe | Ce qu'il ferme |
|---|---|
| 1 | la qualification d'employeur, de maître d'œuvre ou d'intermédiaire payé |
| 2 | la croyance qu'une **vérification BCE** vaudrait garantie de compétence — le mot « certifié » est banni |
| 3 | la publication de l'intérieur d'un client sans son accord (droit à l'image, vie privée) |
| 4 | la publication d'une image qui n'est pas celle de l'entreprise (banque d'images, chantier d'un confrère), d'une personne identifiable, ou d'un **numéro de rue** — donc d'une adresse privée — et les **coordonnées GPS** cachées dans les métadonnées du fichier |
| 5 | la publication d'un **numéro personnel** de salarié, et le numéro qui survivrait à la fiche |
| 6 | la promesse d'un « suivi de devis » : rien ne passe par la plateforme |
| 7 | le classement payant déguisé, et l'achat d'un rang |
| 8 | le prix annoncé sans possibilité de facturer, et la facturation du particulier |

**Huit paragraphes**, et le tableau en compte huit : c'est la même règle que partout ailleurs dans ce
projet — un total affiché se recalcule depuis ses lignes. Le paragraphe 4 est arrivé le 25/10 avec la
**décision 37** (l'image de marque, logo ou photo d'entreprise), et il a décalé les quatre suivants.

## Trois choses au moment de l'insertion

1. **Les trois langues dans la même passe** (`cgu.nl.html`, `cgu.en.html`), puis
   `node --test tests/legal.test.mjs` — même règle que pour « 2 bis » : une insertion en français seul
   crée une asymétrie que la suite ne voit pas encore.
2. **`confidentialite.html`** doit dire, dans la même passe : aucune demande de devis conservée, aucune
   adresse de particulier, photos et **image de marque** servies depuis la machine, **métadonnées de
   l'image effacées** (donc aucune coordonnée de localisation), numéro effacé avec la fiche — mais
   **l'image de marque conservée tant que le compte vit**, puisqu'elle sert sur les cinq portes et ne
   suit pas l'échéance.
3. **L'ordre des articles** : « 2 bis » puis « 2 ter » sont les deux premières d'une série qui ira jusqu'à
   huit. Le jour où `/annonce` et `/immo` auront la leur, il faudra relire la numérotation d'ensemble
   plutôt que d'empiler des bis.

## Ce que cette clause n'est pas

Ce n'est pas un désaveu du professionnel : elle dit ce que **Kazendra** ne fait pas, pas que son travail
serait douteux. La différence est dans la formulation — « nous ne vérifions pas l'assurance » et non
« l'assurance n'est pas garantie » : la première est vraie et vérifiable, la seconde insinue.
