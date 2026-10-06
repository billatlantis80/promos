#!/bin/bash
# Sonde n°3 — trouver les VRAIES adresses des pays manquants (de, nl, ie) et
# comprendre ce que font at/se. On affiche l'URL FINALE (`url_effective`) :
# sans elle, on ne voit pas qu'un domaine redirige ailleurs — et on croirait
# à tort que le pays a des offres.
set -u
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'

sonde() { # domaine chemin
  local corps code html fin
  corps=$(curl -sL --max-time 25 -A "$UA" -H 'Accept-Language: fr,en;q=0.8' \
            -w '\n@@%{http_code}|%{url_effective}' "https://$1$2" 2>/dev/null | tr -d '\000')
  meta=$(printf '%s' "$corps" | tail -1)
  html=$(printf '%s' "$corps" | sed '$d')
  printf '%-14s %-22s %-5s CARTES=%-5s BARRE=%-4s → %s\n' \
    "$1" "$2" "$(printf '%s' "$meta" | sed 's/@@//;s/|.*//')" \
    "$(printf '%s' "$html" | grep -o 'StandardDealCard' | wc -l)" \
    "$(printf '%s' "$html" | grep -o 'strikeThroughPrice' | wc -l)" \
    "$(printf '%s' "$meta" | sed 's/.*|//' | cut -c1-64)"
}

echo "=== ALLEMAGNE ==="
for p in /deals /gutscheine /aktivitaeten /freizeit /wellness /stadt /deals/ /; do sonde groupon.de "$p"; done
echo "=== PAYS-BAS ==="
for p in /deals /cadeaubonnen /uitjes /activiteiten /aanbiedingen /; do sonde groupon.nl "$p"; done
echo "=== IRLANDE ==="
for p in /deals /local /; do sonde groupon.ie "$p"; done
echo "=== AUTRICHE / SUEDE / PORTUGAL (qui redirige où ?) ==="
sonde groupon.at /local
sonde groupon.se /local
sonde groupon.pt /local
echo "=== RÉFÉRENCES (doivent ressortir avec NEXT et cartes) ==="
sonde groupon.be /fr/landing/sale
sonde groupon.fr /bon-plan
sonde groupon.it /offerte
sonde groupon.es /ofertas
sonde groupon.pl /local
sonde groupon.co.uk /deals
sonde domainequinexistepas.invalid /local
