# Les règles des cartes

**Réécriture entreprise le 14 octobre 2026, à la demande de B** : *« je souhaiterais écrire
à nouveau toutes les règles, une par une »*. L'écrit précédent a été effacé (il reste dans
le commit `c5d7847d` si on veut le relire) ; ce fichier repart de zéro.

Aucune règle n'est encore écrite ici. La façon de procéder est à décider : B les dicte une
par une, ou elles sont présentées dans le format ci-dessous pour être corrigées.

## Le format d'une règle

Chaque règle tient dans ce gabarit — court, et chaque ligne sert à quelque chose :

> ### N. Le titre de la règle
>
> **Règle.** L'énoncé, en une phrase, tel qu'on pourrait le lire à voix haute.
>
> **Ce qu'elle regarde.** Le signal exact qui décide — quelle donnée, et pourquoi celle-là
> plutôt qu'une autre.
>
> **Ce qu'elle fait.** La conséquence, précisément : la carte sort, la carte reste, le prix
> est corrigé, la fiche est masquée sans être effacée.
>
> **Son état.** Allumée ou éteinte, et si elle est éteinte, ce qui manque pour l'allumer.
>
> **D'où elle vient.** La phrase d'origine et sa date, mot pour mot.

## Les règles à écrire, une par une

Neuf sujets, recensés dans le code le 14/10/2026. Ils se répartissent en trois familles :
celles qui font **sortir** une carte, celles qui posent un **délai**, et celles qui
tranchent les **cas douteux**.

**Ce qui fait sortir une carte**

1. La page décide de la carte
2. Le retrait sur verdict

**Les délais**

3. Le masquage à sept jours (le plafond de données)
4. Le retour d'une offre (les sept jours pleins)
5. La veille
6. La presse
7. La source disparue
8. Le verdict revérifié

**Les cas douteux**

9. En cas de doute, on retire

## Ce que la réécriture devra trancher

Trois questions se posent dès la première règle, et il vaut mieux les voir maintenant que
les découvrir au milieu :

- **Qui décide d'une sortie** : la page d'origine (son verdict écrit), ou nous (le silence
  d'une source, un délai écoulé) ? Aujourd'hui, c'est la page, et le silence a été mesuré à
  **48 % de faux positifs**.
- **Masquer ou effacer** : une fiche hors délai peut quitter l'affichage sans quitter le
  fichier. C'est ce qui se passe aujourd'hui — 7 486 fiches masquées, aucune effacée.
- **Ce qui se rattrape, et ce qui ne se rattrape pas** : une fiche masquée revient toute
  seule si sa source la ressert ; une fiche effacée, non.
