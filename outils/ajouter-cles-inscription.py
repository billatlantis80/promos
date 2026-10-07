#!/usr/bin/env python3
"""Ajoute les 6 phrases du formulaire d'inscription aux 9 langues.

Reutilisees telles quelles (elles existent deja, ne pas les dupliquer) :
  - 'Adresse e-mail'
  - 'Je veux recevoir les bons plans par e-mail. Désinscription en un clic.'

Le script choisit LUI-MEME le guillemet : une phrase contenant une apostrophe
(« n'est ») ne peut pas etre delimitee par des guillemets simples sans etre
echappee — et un echappement oublie casse tout le fichier de traductions.
Idempotent, et relit le fichier ecrit avant d'annoncer.
"""
import re
import sys
from pathlib import Path

CHEMIN = Path("/opt/data/webdev/projects/promos/public/langues.js")
LANGUES = ["fr", "nl", "de", "en", "es", "it", "pt", "pl", "sv"]

PHRASES = {
    "Prénom (facultatif)": {
        "fr": "Prénom (facultatif)", "nl": "Voornaam (optioneel)", "de": "Vorname (optional)",
        "en": "First name (optional)", "es": "Nombre (opcional)", "it": "Nome (facoltativo)",
        "pt": "Nome próprio (opcional)", "pl": "Imię (opcjonalnie)", "sv": "Förnamn (frivilligt)",
    },
    "Cette adresse e-mail n'est pas valide.": {
        "fr": "Cette adresse e-mail n'est pas valide.", "nl": "Dit e-mailadres is niet geldig.",
        "de": "Diese E-Mail-Adresse ist nicht gültig.", "en": "This email address is not valid.",
        "es": "Esta dirección de correo no es válida.", "it": "Questo indirizzo e-mail non è valido.",
        "pt": "Este endereço de e-mail não é válido.", "pl": "Ten adres e-mail jest nieprawidłowy.",
        "sv": "Den här e-postadressen är inte giltig.",
    },
    "Coche la case pour recevoir les bons plans : sans ton accord, on ne t'inscrit pas.": {
        "fr": "Coche la case pour recevoir les bons plans : sans ton accord, on ne t'inscrit pas.",
        "nl": "Vink het vakje aan om de koopjes te ontvangen: zonder jouw akkoord schrijven we je niet in.",
        "de": "Setz das Häkchen, um die Angebote zu erhalten: ohne deine Zustimmung melden wir dich nicht an.",
        "en": "Tick the box to receive the deals: without your consent, we do not sign you up.",
        "es": "Marca la casilla para recibir las ofertas: sin tu consentimiento, no te inscribimos.",
        "it": "Spunta la casella per ricevere le offerte: senza il tuo consenso non ti iscriviamo.",
        "pt": "Marca a caixa para receberes as promoções: sem o teu consentimento, não te inscrevemos.",
        "pl": "Zaznacz pole, aby otrzymywać okazje: bez twojej zgody nie zapiszemy cię.",
        "sv": "Kryssa rutan för att få erbjudandena: utan ditt samtycke anmäler vi dig inte.",
    },
    "Ton compte est créé sur cet appareil. Le tableau n'est pas encore branché : ton adresse n'a pas été envoyée.": {
        "fr": "Ton compte est créé sur cet appareil. Le tableau n'est pas encore branché : ton adresse n'a pas été envoyée.",
        "nl": "Je account is aangemaakt op dit toestel. De tabel is nog niet aangesloten: je adres is niet verzonden.",
        "de": "Dein Konto wurde auf diesem Gerät erstellt. Die Tabelle ist noch nicht verbunden: Deine Adresse wurde nicht gesendet.",
        "en": "Your account is created on this device. The sheet is not connected yet: your address has not been sent.",
        "es": "Tu cuenta está creada en este dispositivo. La tabla aún no está conectada: tu dirección no se ha enviado.",
        "it": "Il tuo account è creato su questo dispositivo. La tabella non è ancora collegata: il tuo indirizzo non è stato inviato.",
        "pt": "A tua conta está criada neste aparelho. A tabela ainda não está ligada: o teu endereço não foi enviado.",
        "pl": "Twoje konto zostało utworzone na tym urządzeniu. Arkusz nie jest jeszcze podłączony: twój adres nie został wysłany.",
        "sv": "Ditt konto är skapat på den här enheten. Kalkylarket är inte kopplat än: din adress har inte skickats.",
    },
    "Ton adresse est envoyée. Elle apparaîtra dans ta feuille : c'est elle qui fait foi.": {
        "fr": "Ton adresse est envoyée. Elle apparaîtra dans ta feuille : c'est elle qui fait foi.",
        "nl": "Je adres is verzonden. Het verschijnt in je spreadsheet: die is bepalend.",
        "de": "Deine Adresse wurde gesendet. Sie erscheint in deiner Tabelle: diese ist maßgeblich.",
        "en": "Your address has been sent. It will appear in your sheet: that is the one that counts.",
        "es": "Tu dirección se ha enviado. Aparecerá en tu hoja: es la que vale.",
        "it": "Il tuo indirizzo è stato inviato. Comparirà nel tuo foglio: è quello che conta.",
        "pt": "O teu endereço foi enviado. Vai aparecer na tua folha: é ela que conta.",
        "pl": "Twój adres został wysłany. Pojawi się w twoim arkuszu: to on jest wiążący.",
        "sv": "Din adress har skickats. Den visas i ditt kalkylark: det är det som gäller.",
    },
    "L'envoi n'a pas pu partir. Vérifie ta connexion, puis réessaie.": {
        "fr": "L'envoi n'a pas pu partir. Vérifie ta connexion, puis réessaie.",
        "nl": "Het verzenden is niet gelukt. Controleer je verbinding en probeer opnieuw.",
        "de": "Das Senden hat nicht geklappt. Prüfe deine Verbindung und versuche es erneut.",
        "en": "The message could not be sent. Check your connection and try again.",
        "es": "El envío no ha podido salir. Comprueba tu conexión e inténtalo de nuevo.",
        "it": "L'invio non è partito. Controlla la connessione e riprova.",
        "pt": "O envio não partiu. Verifica a tua ligação e tenta novamente.",
        "pl": "Nie udało się wysłać. Sprawdź połączenie i spróbuj ponownie.",
        "sv": "Det gick inte att skicka. Kontrollera anslutningen och försök igen.",
    },
}


def littéral(s: str) -> str:
    """Écrit une chaîne JS en choisissant le guillemet qui NE demande AUCUN
    échappement. Une apostrophe non échappée dans une chaîne à guillemets
    simples fermerait la chaîne et casserait tout le fichier."""
    if "'" in s and '"' not in s:
        return '"' + s + '"'
    if '"' in s and "'" not in s:
        return "'" + s + "'"
    if "'" in s and '"' in s:
        return '"' + s.replace('"', '\\"') + '"'
    return "'" + s + "'"


source = CHEMIN.read_text(encoding="utf-8")
if all(source.count(littéral(p) + ':') >= 9 for p in PHRASES):
    print("Déjà fait : les 6 phrases sont présentes dans les 9 langues. Rien à faire.")
    sys.exit(0)

debut = source.index("const EXTRA = {")
fin = source.index("\n};", debut)
bloc = source[debut:fin]
motif = re.compile(r"\n  (fr|nl|de|en|es|it|pt|pl|sv): \{\n")
bornes = [(m.group(1), m.end()) for m in motif.finditer(bloc)]
if [c for c, _ in bornes] != LANGUES:
    print(f"ERREUR : langues trouvées = {[c for c, _ in bornes]}")
    sys.exit(1)

nouveau = bloc
inseres = 0
for code, ouverture in reversed(bornes):
    fermeture = nouveau.index("\n  },", ouverture)
    lignes = "".join(
        f"\n    {littéral(cle)}: {littéral(valeurs[code])}," for cle, valeurs in PHRASES.items()
    )
    nouveau = nouveau[:fermeture] + lignes + nouveau[fermeture:]
    inseres += 1

CHEMIN.write_text(source[:debut] + nouveau + source[fin:], encoding="utf-8")

relu = CHEMIN.read_text(encoding="utf-8")
print(f"Insertions : {inseres} blocs de langue.")
for cle, valeurs in PHRASES.items():
    n = relu.count(littéral(cle) + ":")
    etat = "OK" if n >= 9 else "MANQUANT"
    print(f"  {etat} ({n}/9) {cle[:62]}")
    if n < 9:
        sys.exit(1)
print("6/6 phrases présentes dans les 9 langues.")
