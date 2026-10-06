#!/bin/bash
# Sonde n°2 — le BON signal cette fois.
#
# La sonde n°1 comptait `priceSpecification`, qui appartient au JSON-LD des
# pages PRODUITS (lecteur d'enseigne). Les ACTIVITÉS, elles, sont lues par
# `offresGroupon()`, qui fouille `__NEXT_DATA__` et compte les
# `StandardDealCard`. Compter le mauvais signal aurait conclu « rien nulle
# part » alors que la bonne page existe. On compte donc :
#   NEXT   : présence de __NEXT_DATA__
#   CARTES : nombre de "StandardDealCard"   ← LA mesure qui compte
#   BARRÉ  : nombre de "strikeThroughPrice" ← le deuxième prix (donc une vraie remise)
set -u
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'

sonde() { # domaine chemin
  local corps code html
  corps=$(curl -sL --max-time 25 -A "$UA" -H 'Accept-Language: fr,en;q=0.8' \
            -w '\n@@%{http_code}' "https://$1$2" 2>/dev/null | tr -d '\000')
  code=$(printf '%s' "$corps" | tail -1 | sed 's/@@//')
  html=$(printf '%s' "$corps" | sed '$d')
  printf '%-16s %-22s %-5s NEXT=%-3s CARTES=%-5s BARRE=%s\n' \
    "$1" "$2" "${code:-000}" \
    "$(printf '%s' "$html" | grep -c '__NEXT_DATA__')" \
    "$(printf '%s' "$html" | grep -o 'StandardDealCard' | wc -l)" \
    "$(printf '%s' "$html" | grep -o 'strikeThroughPrice' | wc -l)"
}

echo "=== PISTES D'ACTIVITÉS, PAR PAYS ==="
sonde groupon.be /fr/landing/sale
sonde groupon.be /fr/bon-plan
sonde groupon.fr /bon-plan
sonde groupon.fr /fr/bon-plan
sonde groupon.de /local
sonde groupon.de /angebote
sonde groupon.it /local
sonde groupon.it /offerte
sonde groupon.es /local
sonde groupon.es /ofertas
sonde groupon.pl /local
sonde groupon.pl /okazje
sonde groupon.nl /local
sonde groupon.nl /aanbiedingen
sonde groupon.co.uk /deals
sonde groupon.co.uk /local
sonde groupon.ie /local
sonde groupon.pt /local
sonde groupon.at /local
sonde groupon.se /local
echo "--- contrôle négatif (doit être à 000/0 partout) ---"
sonde domainequinexistepas.invalid /local
